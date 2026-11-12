'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/require-staff'
import { brisbaneToday } from '@/lib/hub/figures'
import { isoAdd, isoDow, longDate, onCadence, CAL_DOW } from '@/lib/hub/timetable'
import { homeOf, homeNext, schedText, rState, HOME_COLS, cash, dLong, dShort, t12, type Home } from '@/lib/hub/homes'
import { EMAIL_RE } from '@/lib/hub/home-quotes'

type Done = { ok: true; id: string; toast: string } | { ok: false; error: string }
const NO_DB = 'Couldn’t reach the hub. Check your connection and try again.'
const GONE = 'This client was removed.'
const ISO = /^\d{4}-\d{2}-\d{2}$/
const HM = /^\d{2}:\d{2}$/

function refresh(id?: string) {
  revalidatePath('/hub/residential/clients')
  if (id) revalidatePath(`/hub/residential/clients/${id}`)
  revalidatePath('/hub')
}
async function open(id: string): Promise<{ db: any; h: Home; cleaners: Map<string, string> } | { error: string }> {
  const denied = await requireStaff()
  if (denied) return { error: denied }
  if (!z.string().uuid().safeParse(id).success) return { error: GONE }
  const db = createClient() as any
  const [{ data, error }, cl] = await Promise.all([
    db.from('homes').select(HOME_COLS).eq('id', id).maybeSingle(),
    db.from('profiles').select('id, full_name').eq('role', 'cleaner'),
  ])
  if (error) return { error: NO_DB }
  if (!data) return { error: GONE }
  return { db, h: homeOf(data), cleaners: new Map(((cl.data as any[]) || []).map(p => [p.id, p.full_name || 'Cleaner'])) }
}
const shortName = (n: string) => (n || '').trim().split(/\s+/)[0] || n
const nameOf = (m: Map<string, string>, id: string | null) => (id && m.get(id) ? shortName(m.get(id)!) : 'Unassigned')

async function write(db: any, h: Home, patch: Record<string, any>, history: string | null): Promise<string | null> {
  const { error } = await db.from('homes').update(patch).eq('id', h.id)
  if (error) return NO_DB
  if (history) await db.from('home_history').insert({ home_id: h.id, date: brisbaneToday(), text: history.slice(0, 1000) })
  refresh(h.id)
  return null
}

export async function setHomeCleaner(id: string, cleanerId: string): Promise<Done> {
  const o = await open(id); if ('error' in o) return { ok: false, error: o.error }
  const { db, h, cleaners } = o
  const v = cleanerId || null
  if (v && !cleaners.has(v)) return { ok: false, error: 'That cleaner can’t be picked. Refresh and try again.' }
  if ((h.cleaner_id || null) === v) return { ok: true, id, toast: '' }
  if (['ended', 'done', 'cancelled'].includes(rState(h, brisbaneToday()))) return { ok: false, error: `${h.name} has finished, so the cleaner can’t change.` }
  const e = await write(db, h, { cleaner_id: v }, `Cleaner changed from ${nameOf(cleaners, h.cleaner_id)} to ${nameOf(cleaners, v)}`)
  if (e) return { ok: false, error: e }
  return { ok: true, id, toast: v ? `${nameOf(cleaners, v)} now cleans for ${h.name}. They see it in their app from the next clean.` : `${h.name} has no cleaner now. It shows as Unassigned in the timetable.` }
}

export async function setHomeTime(id: string, start: string, finish: string): Promise<Done> {
  const o = await open(id); if ('error' in o) return { ok: false, error: o.error }
  const { db, h, cleaners } = o
  if (!HM.test(start || '')) return { ok: false, error: 'Add the start time.' }
  if (!HM.test(finish || '')) return { ok: false, error: 'Add the finish time.' }
  if (finish <= start) return { ok: false, error: 'The finish time is before the start time.' }
  if (h.start_time === start && h.finish_time === finish) return { ok: true, id, toast: '' }
  const was = h.start_time ? t12(h.start_time) + (h.finish_time ? ' to ' + t12(h.finish_time) : '') : ''
  const now = t12(start) + ' to ' + t12(finish)
  const e = await write(db, h, { start_time: start, finish_time: finish }, (was ? `Time changed from ${was} to ` : 'Time set to ') + now)
  if (e) return { ok: false, error: e }
  return { ok: true, id, toast: `${h.name}’s cleans are now ${now}.` + (h.cleaner_id ? ` ${nameOf(cleaners, h.cleaner_id)} sees the new time in their app.` : '') }
}

export async function pauseHome(id: string, from: string, restart: string, note: string): Promise<Done> {
  const o = await open(id); if ('error' in o) return { ok: false, error: o.error }
  const { db, h, cleaners } = o
  const today = brisbaneToday(), nt = String(note || '').trim().slice(0, 500)
  if (h.kind === 'oneoff') return { ok: false, error: 'A one-off can’t be paused. Cancel it or move the date instead.' }
  if (!ISO.test(from || '')) return { ok: false, error: 'Pick the first day with no cleans.' }
  if (from < today) return { ok: false, error: 'That date has passed. Pick today or later.' }
  if (restart && (!ISO.test(restart) || restart <= from)) return { ok: false, error: 'The restart date has to be after the pause starts.' }
  const e = await write(db, h, { status: 'paused', paused_from: from, resume_on: restart || null }, `Paused from ${dShort(from)}` + (restart ? `, restarts ${dShort(restart)}` : '') + (nt ? `. ${nt}` : ''))
  if (e) return { ok: false, error: e }
  return { ok: true, id, toast: `${h.name} is paused from ${dShort(from)}. ${nameOf(cleaners, h.cleaner_id)} stops seeing those cleans.` }
}

export async function resumeHome(id: string): Promise<Done> {
  const o = await open(id); if ('error' in o) return { ok: false, error: o.error }
  const { db, h } = o
  if (h.status !== 'paused') return { ok: true, id, toast: `${h.name} is already on.` }
  const e = await write(db, h, { status: 'active', paused_from: null, resume_on: null }, 'Resumed')
  if (e) return { ok: false, error: e }
  const today = brisbaneToday()
  const nx = homeNext({ ...h, status: 'active', paused_from: null, resume_on: null }, today, 1)[0] || today
  return { ok: true, id, toast: `${h.name} is back on. Next clean ${dShort(nx)}.` }
}

export async function endHome(id: string, last: string, note: string): Promise<Done> {
  const o = await open(id); if ('error' in o) return { ok: false, error: o.error }
  const { db, h } = o
  const today = brisbaneToday(), nt = String(note || '').trim().slice(0, 500)
  if (h.kind === 'oneoff') return { ok: false, error: 'A one-off can’t be ended. Cancel it instead.' }
  if (!ISO.test(last || '')) return { ok: false, error: 'Pick the last clean date.' }
  if (last < isoAdd(today, -1)) return { ok: false, error: 'Pick yesterday or later. Past cleans are already in their history.' }
  const e = await write(db, h, { status: 'ended', ended_on: last, paused_from: null, resume_on: null }, `Service ended, last clean ${dShort(last)}` + (nt ? `. ${nt}` : ''))
  if (e) return { ok: false, error: e }
  return { ok: true, id, toast: `${h.name} ends after ${dShort(last)}. They move to Finished, with every detail kept.` }
}

export async function reactivateHome(id: string): Promise<Done> {
  const o = await open(id); if ('error' in o) return { ok: false, error: o.error }
  const { db, h } = o
  const e = await write(db, h, { status: 'active', ended_on: null }, 'Reactivated')
  if (e) return { ok: false, error: e }
  return { ok: true, id, toast: `${h.name} is active again.` }
}

export async function markHomeDone(id: string): Promise<Done> {
  const o = await open(id); if ('error' in o) return { ok: false, error: o.error }
  const { db, h } = o
  if (h.kind !== 'oneoff' || h.done || h.cancelled) return { ok: false, error: 'This clean can’t be marked done.' }
  if ((h.first_clean || '') > brisbaneToday()) return { ok: false, error: 'You can mark it done on the day.' }
  const e = await write(db, h, { done: true }, 'Marked done')
  if (e) return { ok: false, error: e }
  return { ok: true, id, toast: `${h.name}’s clean is marked done.` }
}

export async function cancelHomeClean(id: string, note: string): Promise<Done> {
  const o = await open(id); if ('error' in o) return { ok: false, error: o.error }
  const { db, h, cleaners } = o
  if (h.kind !== 'oneoff' || h.done || h.cancelled) return { ok: false, error: 'This clean can’t be cancelled.' }
  const nt = String(note || '').trim().slice(0, 500)
  const e = await write(db, h, { cancelled: true }, 'Cancelled' + (nt ? `. ${nt}` : ''))
  if (e) return { ok: false, error: e }
  return { ok: true, id, toast: `${h.name}’s clean on ${dShort(h.first_clean)} is cancelled.` + (h.cleaner_id ? ` ${nameOf(cleaners, h.cleaner_id)} no longer sees it.` : '') }
}

/** Book it again: reopens a done or cancelled one-off. If its date has passed, the page sends you to Edit for a new date. */
export async function reopenHome(id: string): Promise<Done | { ok: false; error: string; needDate: true }> {
  const o = await open(id); if ('error' in o) return { ok: false, error: o.error }
  const { db, h } = o
  if (h.kind !== 'oneoff' || (!h.done && !h.cancelled)) return { ok: false, error: 'This clean is already booked.' }
  if ((h.first_clean || '') < brisbaneToday()) return { ok: false, error: 'Pick a new date to book it again.', needDate: true }
  const e = await write(db, h, { done: false, cancelled: false }, `Reopened (was ${h.cancelled ? 'cancelled' : 'done'})`)
  if (e) return { ok: false, error: e }
  return { ok: true, id, toast: `${h.name} is booked again for ${dShort(h.first_clean)}.` }
}

/** Delete (for mistakes): only without a signed agreement. Their unsigned documents go with them. */
export async function deleteHome(id: string): Promise<Done> {
  const o = await open(id); if ('error' in o) return { ok: false, error: o.error }
  const { db, h } = o
  const { data: signed, error: se } = await db.from('home_docs').select('id').eq('home_id', id).eq('status', 'signed').limit(1)
  if (se) return { ok: false, error: NO_DB }
  if (signed?.length) return { ok: false, error: 'They have a signed agreement, so end the service instead.' }
  const { error } = await db.from('homes').delete().eq('id', id)
  if (error) return { ok: false, error: NO_DB }
  refresh()
  return { ok: true, id, toast: `${h.name} is deleted, with their unsigned documents.` }
}

// ── New client / Edit ─────────────────────────────────────────
export interface HomeForm {
  id?: string; kind: 'recurring' | 'oneoff'; name: string; phone: string; email: string; street: string; suburb: string; postcode: string; state: string
  beds: string; baths: string; carpetRooms: string; hallways: string; every: 'weekly' | 'fortnightly' | 'monthly'; days: string[]; first: string
  start: string; finish: string; cleaner: string; price: string; cost: string; notes: string
}
const STATES = ['QLD', 'NSW', 'ACT', 'VIC', 'TAS', 'SA', 'WA', 'NT']
export async function parseMoney(v: string): Promise<number | null> {
  const t = String(v ?? '').replace(/[$,\s]/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null
  const n = parseFloat(t)
  return n > 0 && n < 100000 ? n : null
}
const DAYNAME: Record<string, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' }
const ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const joinAnd = (a: string[]) => (a.length <= 1 ? a[0] || '' : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1])

/** Add or save a residential client. Same checks and words as the mock-up. */
export async function saveHome(x: HomeForm): Promise<Done> {
  const denied = await requireStaff()
  if (denied) return { ok: false, error: denied }
  const db = createClient() as any
  const today = brisbaneToday()
  const isEdit = !!x.id
  if (isEdit && !z.string().uuid().safeParse(x.id).success) return { ok: false, error: GONE }
  let old: Home | null = null
  if (isEdit) {
    const { data, error } = await db.from('homes').select(HOME_COLS).eq('id', x.id).maybeSingle()
    if (error) return { ok: false, error: NO_DB }
    if (!data) return { ok: false, error: GONE }
    old = homeOf(data)
  }
  const kind = x.kind === 'oneoff' ? 'oneoff' : 'recurring'
  if (old && old.kind === 'recurring' && kind === 'oneoff') return { ok: false, error: 'A regular client can’t become a one-off. End their service instead.' }
  const isR = kind === 'recurring'
  const every = (['weekly', 'fortnightly', 'monthly'] as const).includes(x.every) ? x.every : 'weekly'
  const days = ORDER.filter(d => (x.days || []).includes(d))
  const started = !!old && old.kind === 'recurring' && !!old.first_clean && old.first_clean <= today
  const dm = !isR ? 'oneoff' : started ? (every === 'weekly' ? 'none' : 'pattern') : 'first'
  const nm = String(x.name || '').trim().replace(/\s+/g, ' ')
  const ph = String(x.phone || '').trim(), em = String(x.email || '').trim(), digits = ph.replace(/[^\d]/g, '')
  const street = String(x.street || '').trim(), suburb = String(x.suburb || '').trim(), first = String(x.first || '')
  const fail = (m: string): Done => ({ ok: false, error: m })
  if (nm.length < 2 || nm.length > 200) return fail('Add the client’s name.')
  if (!ph && !em) return fail('Add a phone number or an email so you can reach them.')
  if (ph && (digits.length < 8 || digits.length > 11)) return fail('Check the phone number. Use 10 digits, like 0412 345 678.')
  if (em && (!EMAIL_RE.test(em) || em.length > 320)) return fail('Check the email address.')
  if (!street || street.length > 300) return fail('Add the street address.')
  if (!suburb || suburb.length > 100) return fail('Add the suburb.')
  if (!/^\d{4}$/.test(x.postcode || '')) return fail('Postcode is 4 digits.')
  if (isR && !days.length) return fail('Pick the cleaning day.')
  if (isR && every === 'monthly' && days.length !== 1) return fail('Once a month is one day only.')
  if (dm !== 'none') {
    if (!ISO.test(first)) return fail(dm === 'oneoff' ? 'Pick the clean date.' : dm === 'pattern' ? 'Pick the next clean date so the hub knows which weeks they’re on.' : 'Pick the first clean date.')
    const keepOld = !!old && dm === 'oneoff' && old.kind === 'oneoff' && old.first_clean === first
    if (first < today && !keepOld) return fail('That date has passed. Pick today or later.')
    if (isR && !days.includes(CAL_DOW[isoDow(first)])) return fail(`The date is a ${longDate(first).split(' ')[0]}, but the cleaning ${days.length > 1 ? 'days are ' : 'day is '}${joinAnd(days.map(d => DAYNAME[d]))}. Pick a date on a cleaning day.`)
  }
  if (!HM.test(x.start || '')) return fail('Add the start time.')
  if (!HM.test(x.finish || '')) return fail('Add the finish time.')
  if (x.finish <= x.start) return fail('The finish time is before the start time.')
  const pr = await parseMoney(x.price), co = await parseMoney(x.cost)
  if (pr === null) return fail('Add the client price per clean, including GST.')
  if (co === null) return fail('Add the cleaner cost per clean.')
  const num = (v: string, max: number) => Math.min(Math.max(parseInt(v, 10) || 0, 0), max)
  const cleaner = x.cleaner || null
  if (cleaner) {
    const { data: c } = await db.from('profiles').select('id').eq('id', cleaner).eq('role', 'cleaner').maybeSingle()
    if (!c) return fail('That cleaner can’t be picked. Choose again.')
  }
  // the same client twice (not finished)
  const { data: same, error: se } = await db.from('homes').select(HOME_COLS).eq('division', 'res')
  if (se) return fail(NO_DB)
  const dup = ((same as any[]) || []).map(homeOf).find(h => h.id !== x.id && h.name.trim().toLowerCase() === nm.toLowerCase() && !['ended', 'done', 'cancelled'].includes(rState(h, today)) && (h.street || '').trim().toLowerCase() === street.toLowerCase())
  if (dup) return fail(`${nm} at ${street} is already a client. Open them from Clients instead.`)

  const base: Record<string, any> = {
    name: nm, phone: ph || null, email: em || null, street, suburb, postcode: x.postcode, state: STATES.includes(x.state) ? x.state : 'QLD',
    beds: num(x.beds, 12), baths: num(x.baths, 12), carpet_rooms: num(x.carpetRooms, 40), hallways: num(x.hallways, 20),
    start_time: x.start, finish_time: x.finish, cleaner_id: cleaner, price: pr, cost: co, notes: String(x.notes || '').trim().slice(0, 3000) || null,
  }
  if (!old) {
    const row = { ...base, division: 'res', kind, every: isR ? every : null, days: isR ? days : [], anchor: isR && every !== 'weekly' ? first : null, first_clean: first, status: 'active' }
    const { data, error } = await db.from('homes').insert(row).select('id').single()
    if (error || !data) return fail(NO_DB)
    await db.from('home_history').insert({ home_id: data.id, date: today, text: isR ? `Added. First clean ${dLong(first)}` : `Booked for ${dLong(first)}` })
    refresh(data.id)
    return { ok: true, id: data.id, toast: `Added ${nm}. Nothing is sent to them. Send their agreement from their page when you’re ready.` }
  }

  const { data: cl } = await db.from('profiles').select('id, full_name').eq('role', 'cleaner')
  const cleaners = new Map<string, string>(((cl as any[]) || []).map(p => [p.id, p.full_name || 'Cleaner']))
  const changes: string[] = []
  const hist: string[] = []
  if ((old.cleaner_id || null) !== cleaner) changes.push(`cleaner ${nameOf(cleaners, old.cleaner_id)} to ${nameOf(cleaners, cleaner)}`)
  if (old.price !== pr) changes.push(`price ${cash(old.price)} to ${cash(pr)}`)
  const patch: Record<string, any> = { ...base }
  if (old.kind === 'oneoff' && isR) {
    hist.push(`Was a one-off on ${dShort(old.first_clean)}. Now ${({ weekly: 'every week', fortnightly: 'every fortnight', monthly: 'once a month' } as any)[every]} from ${dShort(first)}`)
    Object.assign(patch, { kind: 'recurring', every, days, first_clean: first, anchor: every !== 'weekly' ? first : null, done: false, cancelled: false, status: 'active', paused_from: null, resume_on: null, ended_on: null })
  } else if (!isR) {
    if (old.first_clean !== first) { changes.push(`moved to ${dShort(first)}`); patch.first_clean = first }
  } else {
    const next: Home = { ...old, every, days }
    if (dm === 'first') { patch.first_clean = first; patch.anchor = every !== 'weekly' ? first : null; next.first_clean = first; next.anchor = patch.anchor }
    else if (dm === 'pattern') { patch.anchor = first; next.anchor = first }
    else { patch.anchor = null; next.anchor = null }
    patch.every = every; patch.days = days
    const schedChanged = old.every !== every || (old.days || []).join() !== days.join() || (dm === 'first' && old.first_clean !== first) || (dm === 'pattern' && !onCadence({ every: old.every, anchor: old.anchor || old.first_clean, first: old.first_clean }, first))
    if (schedChanged) changes.push('schedule now ' + schedText(next).toLowerCase())
  }
  const { error } = await db.from('homes').update(patch).eq('id', old.id)
  if (error) return fail(NO_DB)
  if (changes.length) hist.push('Changed ' + changes.join('; '))
  for (const t of hist) await db.from('home_history').insert({ home_id: old.id, date: today, text: t.slice(0, 1000) })
  refresh(old.id)
  return { ok: true, id: old.id, toast: `Saved ${nm}.` }
}
