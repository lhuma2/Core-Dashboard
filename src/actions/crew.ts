'use server'
// The cleaner app's buttons (mock-up Cleaner.dc.html). Every write is done here with the service key, after checking
// the signed-in cleaner is on that home or site that day, so cleaners need no write rights on the tables themselves.
import { revalidatePath } from 'next/cache'
import { crewServer } from '@/lib/crew/server-client'
import { createAdminClient } from '@/lib/supabase/admin'
import { brisbaneToday } from '@/lib/hub/figures'
import { sendEmail } from '@/lib/email'
import { sendPushToRole } from '@/lib/push'
import { crewMe, loadCrewJob, type Me } from '@/lib/crew/data'
import { advance, cap, dateLabel, MAXPH, parseKey, t12, type CrewJob } from '@/lib/crew/jobs'
import { divBase } from '@/lib/hub/div'

type R<T = {}> = ({ ok: true } & T) | { ok: false; error: string }
const OFFLINE = 'That didn’t save. Check your signal and try again.'
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
const nowLabel = () => new Intl.DateTimeFormat('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Australia/Brisbane' }).format(new Date()).replace(/\s/g, ' ').toLowerCase()

async function mine(key: string): Promise<{ me: Me; job: CrewJob } | { error: string }> {
  const me = await crewMe()
  if (!me) return { error: 'You’ve been logged out. Log in again to carry on.' }
  const job = await loadCrewJob(me, key)
  if (job === null) return { error: OFFLINE }
  if (job === 'missing') return { error: 'This clean isn’t on your list any more. Go back to My jobs.' }
  return { me, job }
}

/** The job's row, made the first time it's needed (Start clean). Safe if two taps race: the unique index wins. */
async function ensureRun(me: Me, job: CrewJob): Promise<string | null> {
  if (job.jobId) return job.jobId
  const db = createAdminClient() as any
  const k = parseKey(job.key)!
  const row: any = {
    type: job.kind === 'com' ? 'commercial' : job.kind === 'eol' ? 'eol' : 'residential', clean_date: job.iso,
    start_time: job.start || null, finish_time: job.finish || null, status: 'booked', photos_needed: job.minPh,
  }
  if (k.t === 'h') row.home_id = k.id
  else { row.service_id = k.id; row.client_id = job.clientId; row.site_name = job.name }
  const ins = await db.from('jobs').insert(row).select('id').single()
  let id: string | null = ins.data?.id ?? null
  if (!id) {
    const again = await db.from('jobs').select('id').eq(k.t === 'h' ? 'home_id' : 'service_id', k.id).eq('clean_date', job.iso).maybeSingle()
    id = again.data?.id ?? null
  }
  if (!id) return null
  const on = await db.from('job_cleaners').select('job_id').eq('job_id', id).eq('cleaner_id', me.profileId)
  if (!on.error && !(on.data || []).length) await db.from('job_cleaners').insert({ job_id: id, cleaner_id: me.profileId })
  return id
}

export async function startClean(key: string): Promise<R<{ at: string }>> {
  const m = await mine(key)
  if ('error' in m) return { ok: false, error: m.error }
  const { me, job } = m
  if (job.iso !== brisbaneToday()) return { ok: false, error: 'This clean is on ' + dateLabel(job.iso) + '. You can start it then.' }
  if (job.status !== 'booked') return { ok: true, at: job.startedAt || '' }
  const id = await ensureRun(me, job)
  if (!id) return { ok: false, error: OFFLINE }
  const db = createAdminClient() as any
  const at = new Date().toISOString()
  const { error } = await db.from('jobs').update({ status: 'in_progress', started_at: at }).eq('id', id).eq('status', 'booked')
  if (error) return { ok: false, error: OFFLINE }
  revalidatePath('/cleaner/app', 'layout')
  return { ok: true, at }
}

const TICK = /^(\d{1,2}\.\d{1,3}|x:[0-9a-f-]{36}(\.\d{1,3})?|ack)$/
/** Save the checklist (optional ticks, add-on ticks and Mark done, the End of Lease photo box). */
export async function saveTicks(key: string, ticks: Record<string, boolean>): Promise<R> {
  const m = await mine(key)
  if ('error' in m) return { ok: false, error: m.error }
  const { job } = m
  if (job.status === 'booked') return { ok: false, error: 'Tap Start clean first.' }
  if (job.status === 'done') return { ok: false, error: 'This clean is already finished.' }
  const clean: Record<string, boolean> = {}
  const keys = Object.keys(ticks || {})
  if (keys.length > 500) return { ok: false, error: OFFLINE }
  for (const t of keys) if (TICK.test(t) && ticks[t] === true) clean[t] = true
  const db = createAdminClient() as any
  const { error } = await db.from('jobs').update({ ticks: clean }).eq('id', job.jobId).eq('status', 'in_progress')
  if (error) return { ok: false, error: OFFLINE }
  return { ok: true }
}

/** Finish clean: needs the minimum photos (End of Lease: or the "they're in my library" box). Never waits on uploads. */
export async function finishClean(key: string, photos: number): Promise<R<{ toast: string }>> {
  const m = await mine(key)
  if ('error' in m) return { ok: false, error: m.error }
  const { me, job } = m
  if (job.status === 'booked') return { ok: false, error: 'Tap Start clean first.' }
  if (job.status === 'done') return { ok: true, toast: 'Clean finished. Thanks ' + me.first + '!' }
  const n = Math.max(0, Math.min(MAXPH, Math.floor(Number(photos) || 0)))
  const isEol = job.kind === 'eol', ackd = isEol && !!job.ticks.ack
  if (n < job.minPh && !ackd) {
    return { ok: false, error: (n ? 'Take ' + (job.minPh - n) + ' more photo' + (job.minPh - n === 1 ? '' : 's') + ' of the finished job first (at least ' + job.minPh + ').' : 'Take at least ' + job.minPh + ' photos of the finished job first. Tap Take or add photos.') + (isEol ? ' If they won’t upload, tick the box to confirm they’re in your phone’s library.' : '') }
  }
  const db = createAdminClient() as any
  const at = new Date().toISOString()
  const fin = (extra: Record<string, any>) => db.from('jobs').update({ status: 'done', finished_at: at, photo_count: n, photo_ack: ackd, ...extra }).eq('id', job.jobId).eq('status', 'in_progress').select('id')
  let { data: upd, error } = await fin({ finished_by: me.profileId })
  // before test-db update 068 there's no finished_by column
  if (error && /finished_by/.test(String(error.message || ''))) ({ data: upd, error } = await fin({}))
  if (error) return { ok: false, error: OFFLINE }
  if (!(upd || []).length) return { ok: true, toast: 'Clean finished. Thanks ' + me.first + '!' }

  // add-ons: done → next due moves on; not done → carried over to the next clean and Laith is told
  const missed: string[] = []
  for (const a of job.addons) {
    if (job.ticks['x:' + a.id]) await db.from('client_addons').update({ next_date: advance(job.iso, a.freq) }).eq('id', a.id)
    else missed.push(a.name)
  }
  // the home's page: one-off cleans are done; every clean gets a history line
  const k = parseKey(job.key)!
  if (k.t === 'h') {
    const line = `Clean on ${dateLabel(job.iso)} finished by ${me.name} at ${nowLabel()}, ${n} photo${n === 1 ? '' : 's'}` + (ackd && n < job.minPh ? ' (the rest are in their phone’s library)' : '')
    if (job.kind === 'eol' || (await db.from('homes').select('kind').eq('id', k.id).maybeSingle()).data?.kind === 'oneoff') await db.from('homes').update({ done: true }).eq('id', k.id)
    await db.from('home_history').insert({ home_id: k.id, date: brisbaneToday(), text: line.slice(0, 1000) })
  }
  if (missed.length) {
    const what = missed.join(' and ')
    const body = `${me.name} finished ${job.name} on ${dateLabel(job.iso)} without ${what}. It moves to the next clean.`
    await sendPushToRole('admin', { title: `${cap(what)} not done`, body, url: '/hub/commercial' }).catch(() => {})
    await sendEmail('admin@corecleaning.services', `${cap(what)} not done at ${job.name}`, `<p>${esc(body)}</p>`).catch(() => {})
  }
  if (ackd && n < job.minPh) {
    await sendPushToRole('admin', { title: `${me.first}’s exit photos are on their phone`, body: `${job.name}: ${me.first} ticked that all ${job.minPh}+ exit photos are in their phone’s library because some wouldn’t upload.`, url: divBase('eol') + '/clients/' + k.id }).catch(() => {})
  }
  revalidatePath('/cleaner/app', 'layout')
  revalidatePath('/hub', 'layout')
  const phMsg = (ackd && n < job.minPh ? ' Laith has been told your exit photos are in your phone’s library. Keep them until Laith says they’re no longer needed.' : '')
  const toast = missed.length
    ? 'Clean finished. ' + cap(missed.map(x => x.toLowerCase()).join(' and ')) + ' wasn’t marked done, so it moves to the next clean and Laith has been told.' + phMsg
    : 'Clean finished. Thanks ' + me.first + '!' + phMsg
  return { ok: true, toast }
}

/** Report a problem: an `issues` row (Problems reported in the hub), an email to admin@ and a push to Laith. */
export async function reportProblem(key: string, text: string): Promise<R> {
  const body = String(text || '').trim()
  if (body.length < 5) return { ok: false, error: 'Describe the problem first.' }
  if (body.length > 2000) return { ok: false, error: 'That’s a bit long. Keep it under 2,000 characters.' }
  const m = await mine(key)
  if ('error' in m) return { ok: false, error: m.error }
  const { me, job } = m
  const k = parseKey(job.key)!
  const db = createAdminClient() as any
  let siteId: string | null = null
  if (k.t === 's') siteId = (await db.from('client_services').select('site_id').eq('id', k.id).maybeSingle()).data?.site_id ?? null
  const { error } = await db.from('issues').insert({
    job_id: job.jobId, client_id: k.t === 's' ? job.clientId : null, site_id: siteId, home_id: k.t === 'h' ? k.id : null, cleaner_id: me.profileId, body,
  })
  if (error) return { ok: false, error: OFFLINE }
  const when = dateLabel(job.iso) + (job.start ? ', ' + t12(job.start) : '')
  await sendPushToRole('admin', { title: `Problem at ${job.name}`, body: `${me.first}: “${body.slice(0, 140)}”`, url: '/hub/problems' }).catch(() => {})
  await sendEmail('admin@corecleaning.services', `Problem reported at ${job.name}`,
    `<p><strong>${esc(me.name)}</strong> reported a problem at <strong>${esc(job.name)}</strong> (${esc(when)}):</p><p style="white-space:pre-line">${esc(body)}</p><p>It’s in Problems reported in the hub.</p>`).catch(() => {})
  revalidatePath('/hub', 'layout')
  return { ok: true }
}

/** First login: choose your own password. 8+ characters, not your first name, both boxes match. */
export async function savePassword(p1: string, p2: string): Promise<R> {
  const me = await crewMe()
  if (!me) return { ok: false, error: 'You’ve been logged out. Log in again to carry on.' }
  const a = String(p1 || ''), b = String(p2 || '')
  if (a.length < 8) return { ok: false, error: 'Use at least 8 characters.' }
  if (a.length > 72) return { ok: false, error: 'That’s too long. Use 72 characters or fewer.' }
  if (me.first && a.toLowerCase().includes(me.first.toLowerCase())) return { ok: false, error: 'Don’t use your first name in your password.' }
  if (a !== b) return { ok: false, error: 'The two passwords don’t match.' }
  const sb = crewServer()
  const { error } = await sb.auth.updateUser({ password: a })
  if (error) {
    if (/different from the old/i.test(error.message)) return { ok: false, error: 'Choose a password that’s different from your starter one.' }
    if (/weak|pwned|leaked/i.test(error.message)) return { ok: false, error: 'That password is too easy to guess. Try a longer one.' }
    return { ok: false, error: OFFLINE }
  }
  const db = createAdminClient() as any
  await db.from('profiles').update({ password_set_at: new Date().toISOString() }).eq('id', me.profileId)
  revalidatePath('/cleaner/app', 'layout')
  return { ok: true }
}
