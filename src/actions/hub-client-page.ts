'use server'

// Commercial client page: details, each service, cleaners, access, additional services, and pause / end / resume.
// Same checks, order and words as the mock-up.

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/require-staff'
import { brisbaneToday, ADDON_PER_YEAR } from '@/lib/hub/figures'
import { normPhone, pcFits, money, fmt$, everyErr, STATES, DAYS, EXTRA_KINDS } from '@/lib/hub/new-client'
import { dLong, dShort } from '@/lib/hub/home-quotes'
import { ADDON_FREQ_LABEL, PAUSE_REASONS, END_REASONS, reasonText, tidy, joinAnd } from '@/lib/hub/client-page'

type R = { ok: true; toast: string } | { ok: false; error: string }
const NO_DB = 'Couldn’t reach the hub. Check your connection and try again.'
const GONE = 'This client was removed. Go back to Clients.'
const ISO = /^\d{4}-\d{2}-\d{2}$/
const HM = /^\d{2}:\d{2}$/
const uuid = (v: unknown) => z.string().uuid().safeParse(v).success
const fail = (error: string): R => ({ ok: false, error })

function refresh() { revalidatePath('/hub', 'layout') }

async function gate(): Promise<{ db: any } | { error: string }> {
  const denied = await requireStaff()
  if (denied) return { error: denied }
  return { db: createClient() as any }
}
async function getClient(db: any, id: string) {
  if (!uuid(id)) return { error: GONE }
  const { data, error } = await db.from('clients').select('id, business_name, status, paused_from, resume_on, ended_on').eq('id', id).maybeSingle()
  if (error) return { error: NO_DB }
  if (!data) return { error: GONE }
  return { c: data as any }
}
/** The service with its site and how many sites the client has. */
async function getService(db: any, sid: string) {
  if (!uuid(sid)) return { error: GONE }
  const { data: s, error } = await db.from('client_services').select('id, client_id, site_id, days, every, anchor, first_clean, start_time, finish_time, price, cost').eq('id', sid).maybeSingle()
  if (error) return { error: NO_DB }
  if (!s) return { error: GONE }
  const [cl, sites] = await Promise.all([
    db.from('clients').select('id, business_name, is_multi_site').eq('id', s.client_id).maybeSingle(),
    db.from('client_sites').select('id, site_name').eq('client_id', s.client_id),
  ])
  if (cl.error || sites.error) return { error: NO_DB }
  if (!cl.data) return { error: GONE }
  const multi = !!cl.data.is_multi_site || (sites.data || []).length > 1
  const site = multi && s.site_id ? (sites.data || []).find((x: any) => x.id === s.site_id) || null : null
  return { s: s as any, c: cl.data as any, site: site as any, sites: (sites.data || []) as any[] }
}
async function log(db: any, clientId: string, text: string) {
  await db.from('client_history').insert({ client_id: clientId, date: brisbaneToday(), text: text.slice(0, 1000) })
}

// ── Business details ──
export interface DetailsForm { contact: string; phone: string; email: string; street: string; suburb: string; postcode: string; state: string }
export async function saveClientDetails(id: string, d: DetailsForm): Promise<R> {
  const g = await gate(); if ('error' in g) return fail(g.error)
  const o = await getClient(g.db, id); if ('error' in o) return fail(o.error!)
  const contact = tidy(d.contact), email = String(d.email || '').trim(), street = tidy(d.street), suburb = tidy(d.suburb), pc = String(d.postcode || '').trim()
  const stt = (STATES as readonly string[]).includes(d.state) ? d.state : 'QLD'
  let phone = ''
  if (tidy(d.phone)) { const p = normPhone(d.phone); if (!p) return fail('That phone number doesn’t look right. Use 10 digits, e.g. 07 3123 4567 or 0412 345 678.'); phone = p }
  if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320)) return fail('That email address doesn’t look right.')
  if (pc && !/^\d{4}$/.test(pc)) return fail('Postcodes have 4 digits.')
  if (pc && !pcFits(pc, stt)) return fail(`Postcode ${pc} isn’t in ${stt}. Check the postcode or the state.`)
  if (contact.length > 200 || street.length > 300 || suburb.length > 100) return fail('One of the details is too long. Shorten it and try again.')
  let sub = suburb
  if (!sub) {
    const { data: s1 } = await g.db.from('client_sites').select('suburb').eq('client_id', id).order('sort_order').limit(1)
    sub = (s1 && s1[0]?.suburb) || ''
  }
  const { error } = await g.db.from('clients').update({ contact_name: contact || null, contact_phone: phone || null, contact_email: email || null, address: street || null, suburb: sub || null, postcode: pc || null, state: stt }).eq('id', id)
  if (error) return fail(NO_DB)
  refresh()
  return { ok: true, toast: 'Business details saved.' }
}

// ── A service (or site) ──
export interface ServiceForm { days: string[]; every: string; pat: string; start: string; finish: string; first: string; price: string; cost: string; sname: string; sstreet: string; ssuburb: string; spostcode: string }
export async function saveService(sid: string, d: ServiceForm): Promise<R> {
  const g = await gate(); if ('error' in g) return fail(g.error)
  const o = await getService(g.db, sid); if ('error' in o) return fail(o.error!)
  const { s, site, sites } = o
  const today = brisbaneToday()
  const first0 = s.first_clean ? String(s.first_clean).slice(0, 10) : ''
  const firstFuture = !first0 || first0 >= today
  const who = site ? site.site_name : 'This service'
  const days = DAYS.map(x => x[0]).filter(k => (d.days || []).includes(k))
  const sn = tidy(d.sname), ss = tidy(d.sstreet), su = tidy(d.ssuburb), sp = String(d.spostcode || '').trim()
  if (site) {
    if (!sn || !ss || !su) return fail('The site needs a name, street address and suburb.')
    if (sp && !/^\d{4}$/.test(sp)) return fail('Postcodes have 4 digits.')
    if (sites.some(y => y.id !== site.id && String(y.site_name || '').toLowerCase() === sn.toLowerCase())) return fail(`Another site is already called ${sn}. Give each site its own name.`)
    if (sn.length > 200 || ss.length > 300 || su.length > 100) return fail('One of the site details is too long. Shorten it and try again.')
  }
  if (!days.length) return fail(`${who}: pick at least one cleaning day.`)
  if (!HM.test(d.start || '')) return fail(`${who}: add a start time.`)
  if (d.finish && !HM.test(d.finish)) return fail(`${who}: the finish time isn’t valid.`)
  if (d.finish && d.finish <= d.start) return fail(`${who}: the finish time must be after the start time.`)
  if (firstFuture) {
    if (!ISO.test(d.first || '')) return fail(`${who}: add the first clean date.`)
    if (d.first < today) return fail(`${who}: the first clean date is in the past.`)
  }
  const ev = d.every || 'weekly'
  const pat = ev === 'weekly' ? '' : firstFuture ? d.first : d.pat
  if (ev !== 'weekly' && !firstFuture && d.pat && d.pat < today) return fail(`${who}: the next clean date is in the past.`)
  const evE = everyErr(who, ev, days, pat, firstFuture ? 'first clean date' : 'next clean date')
  if (evE) return fail(evE)
  const pr = money(d.price), co = money(d.cost)
  if (!co) return fail(`${who}: enter your cleaner cost per visit as a dollar amount, e.g. 120 or 120.50.`)
  if (!pr) return fail(`${who}: enter the client price per visit as a dollar amount, e.g. 180.`)
  if (pr <= co) return fail(`${who}: the client price (${fmt$(pr)}) is not more than your cleaner cost (${fmt$(co)}). Check the two prices.`)
  if (pr >= 100000 || co >= 100000) return fail(`${who}: check the two prices. They look too big.`)
  const patch: Record<string, any> = { days, every: ev, anchor: pat || null, start_time: d.start, finish_time: d.finish || null, price: pr, cost: co }
  if (firstFuture) patch.first_clean = d.first
  const { error } = await g.db.from('client_services').update(patch).eq('id', sid)
  if (error) return fail(NO_DB)
  if (site) {
    const { error: e2 } = await g.db.from('client_sites').update({ site_name: sn, address: ss, suburb: su, postcode: sp || null }).eq('id', site.id)
    if (e2) return fail(NO_DB)
  }
  refresh()
  return { ok: true, toast: `Saved ${site ? sn : 'the service'}. The timetable and Team tab are updated.` }
}

// ── Cleaners: each tap saves straight away ──
export async function toggleServiceCleaner(sid: string, cleanerId: string): Promise<R & { cleaners?: string[] }> {
  const g = await gate(); if ('error' in g) return fail(g.error)
  const o = await getService(g.db, sid); if ('error' in o) return fail(o.error!)
  if (!uuid(cleanerId)) return fail('That cleaner can’t be picked. Refresh and try again.')
  const [{ data: p, error: pe }, { data: on, error: oe }] = await Promise.all([
    g.db.from('profiles').select('id, full_name, pack_signed_at').eq('id', cleanerId).eq('role', 'cleaner').maybeSingle(),
    g.db.from('client_service_cleaners').select('cleaner_id').eq('service_id', sid),
  ])
  if (pe || oe) return fail(NO_DB)
  if (!p) return fail('That cleaner can’t be picked. Refresh and try again.')
  const now: string[] = (on || []).map((x: any) => x.cleaner_id)
  const sel = now.includes(cleanerId)
  if (!sel && !p.pack_signed_at) return fail(`${String(p.full_name || 'They').split(/\s+/)[0]} can’t be assigned until they sign the compliance pack.`)
  const { error } = sel
    ? await g.db.from('client_service_cleaners').delete().eq('service_id', sid).eq('cleaner_id', cleanerId)
    : await g.db.from('client_service_cleaners').insert({ service_id: sid, cleaner_id: cleanerId })
  if (error) return fail(NO_DB)
  refresh()
  return { ok: true, toast: '', cleaners: sel ? now.filter(x => x !== cleanerId) : [...now, cleanerId] }
}

/** The Done toast: "Site is now with A and B." */
export async function cleanersToast(sid: string): Promise<R> {
  const g = await gate(); if ('error' in g) return fail(g.error)
  const o = await getService(g.db, sid); if ('error' in o) return fail(o.error!)
  const { data, error } = await g.db.from('client_service_cleaners').select('cleaner:profiles(full_name)').eq('service_id', sid)
  if (error) return fail(NO_DB)
  const title = o.site ? o.site.site_name : 'Service details'
  const names = ((data || []) as any[]).map(x => String(x.cleaner?.full_name || '').split(/\s+/)[0]).filter(Boolean)
  return { ok: true, toast: names.length ? `${title} is now with ${joinAnd(names)}.` : `${title} has no cleaner assigned yet.` }
}

// ── Access details ──
export async function saveServiceAccess(sid: string, text: string): Promise<R> {
  const g = await gate(); if ('error' in g) return fail(g.error)
  const o = await getService(g.db, sid); if ('error' in o) return fail(o.error!)
  const v = String(text || '').trim()
  if (v.length > 2000) return fail('The access details are too long. Keep them under 2,000 characters.')
  const { error } = await g.db.from('client_services').update({ access: v }).eq('id', sid)
  if (error) return fail(NO_DB)
  refresh()
  return { ok: true, toast: v ? 'Access details saved. Only the assigned cleaners see them.' : 'Access details cleared.' }
}

// ── Additional services ──
async function getAddon(db: any, aid: string) {
  if (!uuid(aid)) return { error: 'That service was removed. Refresh the page.' }
  const { data, error } = await db.from('client_addons').select('id, service_id, name').eq('id', aid).maybeSingle()
  if (error) return { error: NO_DB }
  if (!data) return { error: 'That service was removed. Refresh the page.' }
  return { a: data as any }
}
export async function setAddonDue(aid: string, next: string): Promise<R> {
  const g = await gate(); if ('error' in g) return fail(g.error)
  const o = await getAddon(g.db, aid); if ('error' in o) return fail(o.error!)
  if (!ISO.test(next || '')) return fail(`Pick the date ${o.a.name} is next due.`)
  if (next < brisbaneToday()) return fail('That date has passed. Pick today or later.')
  const { error } = await g.db.from('client_addons').update({ next_date: next }).eq('id', aid)
  if (error) return fail(NO_DB)
  refresh()
  return { ok: true, toast: `${o.a.name} is next due ${dLong(next)}. The cleaners see it on the first clean from then.` }
}
export async function removeAddon(aid: string): Promise<R> {
  const g = await gate(); if ('error' in g) return fail(g.error)
  const o = await getAddon(g.db, aid); if ('error' in o) return fail(o.error!)
  const sv = await getService(g.db, o.a.service_id); if ('error' in sv) return fail(sv.error!)
  const { error } = await g.db.from('client_addons').delete().eq('id', aid)
  if (error) return fail(NO_DB)
  refresh()
  return { ok: true, toast: `Removed ${o.a.name} from ${sv.site ? sv.site.site_name : 'Service details'}.` }
}
export interface AddonForm { kind: string; custom: string; freq: string; price: string; cost: string; next: string; items: string[] }
export async function addAddon(sid: string, d: AddonForm): Promise<R> {
  const g = await gate(); if ('error' in g) return fail(g.error)
  const o = await getService(g.db, sid); if ('error' in o) return fail(o.error!)
  const today = brisbaneToday()
  if (!d.kind || !(EXTRA_KINDS as readonly string[]).includes(d.kind)) return fail('Choose which service it is.')
  const nm = d.kind === 'Custom' ? tidy(d.custom) : d.kind
  if (!nm) return fail('Give the custom service a name.')
  if (nm.length > 200) return fail('The custom service name is too long.')
  if (!d.freq || !(d.freq in ADDON_PER_YEAR)) return fail(`Choose how often ${nm} happens.`)
  const p = money(d.price), c = money(d.cost)
  if (!p) return fail(`Enter your charge per visit for ${nm}, e.g. 350.`)
  if (!c) return fail(`Enter the cleaner cost per visit for ${nm}, e.g. 220.`)
  if (p <= c) return fail(`Your charge for ${nm} (${fmt$(p)}) is not more than the cleaner cost (${fmt$(c)}).`)
  if (p >= 100000) return fail(`Check your charge for ${nm}. It looks too big.`)
  if (!ISO.test(d.next || '')) return fail(`Pick the date ${nm} is first due. It shows in the cleaner app on the first clean from then.`)
  if (d.next < today) return fail('The first due date has passed. Pick today or later.')
  const items = (Array.isArray(d.items) ? d.items : []).map(t => tidy(t))
  if (items.some(t => !t)) return fail(`There’s an empty task under ${nm}. Fill it in or remove it.`)
  if (!items.length) return fail(`List what’s included in ${nm}, at least one task.`)
  if (items.length > 30 || items.some(t => t.length > 300)) return fail(`The task list for ${nm} is too long. Keep it to 30 short tasks.`)
  const { count, error: ce } = await g.db.from('client_addons').select('id', { count: 'exact', head: true }).eq('service_id', sid)
  if (ce) return fail(NO_DB)
  if ((count || 0) >= 10) return fail('That is the most additional services one site can have here (10).')
  const { error } = await g.db.from('client_addons').insert({ service_id: sid, name: nm, freq: d.freq, price: p, cost: c, next_date: d.next, items })
  if (error) return fail(NO_DB)
  refresh()
  const title = o.site ? o.site.site_name : 'Service details'
  return { ok: true, toast: `Added ${nm} (${ADDON_FREQ_LABEL[d.freq]}) to ${title}, first due ${dLong(d.next)}.` + (d.freq === 'once' ? ' It’s one-off, so it isn’t in the monthly total.' : ' Monthly total updated.') }
}

// ── Pause, end, resume, reactivate ──
export async function pauseClient(id: string, from: string, resume: string, reason: string, note: string): Promise<R> {
  const g = await gate(); if ('error' in g) return fail(g.error)
  const o = await getClient(g.db, id); if ('error' in o) return fail(o.error!)
  const today = brisbaneToday()
  if (!ISO.test(from || '')) return fail('Choose the first day with no cleans.')
  if (from < today) return fail('The pause can’t start in the past.')
  if (resume && !ISO.test(resume)) return fail('The restart date isn’t valid.')
  if (resume && resume <= from) return fail('The restart date must be after the pause starts.')
  if (!reason || !(PAUSE_REASONS as readonly string[]).includes(reason)) return fail('Choose a reason.')
  if (reason === 'Other' && !tidy(note)) return fail('Add a short note for the reason.')
  if (tidy(note).length > 500) return fail('Keep the note under 500 characters.')
  const why = reasonText(reason, note)
  const { error } = await g.db.from('clients').update({ status: 'paused', paused_from: from, resume_on: resume || null, ended_on: null, status_reason: why }).eq('id', id)
  if (error) return fail(NO_DB)
  await log(g.db, id, `Paused from ${dShort(from)}${resume ? ` until ${dShort(resume)}` : ''}. ${why}.`)
  refresh()
  return { ok: true, toast: `${o.c.business_name} is paused from ${dShort(from)}${resume ? ` until ${dShort(resume)}` : ''}. Their cleans are off the timetable for that time and they’re under Paused clients.` }
}
export async function endClient(id: string, last: string, reason: string, note: string): Promise<R> {
  const g = await gate(); if ('error' in g) return fail(g.error)
  const o = await getClient(g.db, id); if ('error' in o) return fail(o.error!)
  if (!ISO.test(last || '')) return fail('Choose the date of the last clean.')
  if (!reason || !(END_REASONS as readonly string[]).includes(reason)) return fail('Choose a reason.')
  if (reason === 'Other' && !tidy(note)) return fail('Add a short note for the reason.')
  if (tidy(note).length > 500) return fail('Keep the note under 500 characters.')
  const why = reasonText(reason, note)
  const { error } = await g.db.from('clients').update({ status: 'ended', ended_on: last, paused_from: null, resume_on: null, status_reason: why }).eq('id', id)
  if (error) return fail(NO_DB)
  await log(g.db, id, `Ended, last clean ${dShort(last)}. ${why}.`)
  refresh()
  return { ok: true, toast: `${o.c.business_name} is ended. They’re under Ended clients with all their details and documents. No cleans after ${dShort(last)}.` }
}
export async function resumeClient(id: string): Promise<R> {
  const g = await gate(); if ('error' in g) return fail(g.error)
  const o = await getClient(g.db, id); if ('error' in o) return fail(o.error!)
  if (o.c.status !== 'paused') return { ok: true, toast: `${o.c.business_name} is already active.` }
  const { error } = await g.db.from('clients').update({ status: 'active', paused_from: null, resume_on: null, status_reason: null }).eq('id', id)
  if (error) return fail(NO_DB)
  await log(g.db, id, 'Resumed.')
  refresh()
  return { ok: true, toast: `${o.c.business_name} is active again. Their cleans are back on the timetable.` }
}
export async function reactivateClient(id: string): Promise<R> {
  const g = await gate(); if ('error' in g) return fail(g.error)
  const o = await getClient(g.db, id); if ('error' in o) return fail(o.error!)
  if (o.c.status !== 'ended') return { ok: true, toast: `${o.c.business_name} is already active.` }
  const { error } = await g.db.from('clients').update({ status: 'active', ended_on: null, status_reason: null }).eq('id', id)
  if (error) return fail(NO_DB)
  await log(g.db, id, 'Reactivated.')
  refresh()
  return { ok: true, toast: `${o.c.business_name} is back in Active clients with the same sites, cleaners and prices. Check the times are still right.` }
}

