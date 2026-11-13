// Completion photos (v67). The phone keeps each photo in IndexedDB and, in the background:
//   op "sign"   → a one-time signed upload link for clean-photos/<kind>/<client or home>/<date>/<job>/<photo id>.jpg
//                 (the phone then uploads straight to storage, no Vercel hop, no size limit problems)
//   op "done"   → records the clean_photos row once the upload worked (same photo id twice = still one row)
//   op "remove" → the cleaner took a photo out before finishing
// A route, not a server action, so photos queued before a new deploy still send afterwards.
// Lives under /cleaner so the cleaner's own sign-in cookie is used; signed out = 401 and the photo stays queued.
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { crewMe, loadCrewJob } from '@/lib/crew/data'
import { parseKey } from '@/lib/crew/jobs'

export const dynamic = 'force-dynamic'
const BUCKET = 'clean-photos'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const out = (status: number, body: object) => NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } })

export async function POST(req: Request) {
  let b: any
  try { b = await req.json() } catch { return out(400, { error: 'bad' }) }
  const op = String(b?.op || ''), key = String(b?.key || ''), id = String(b?.id || '').toLowerCase()
  if (!['sign', 'done', 'remove'].includes(op) || !parseKey(key) || !UUID.test(id)) return out(400, { error: 'bad' })

  const me = await crewMe()
  if (!me) return out(401, { error: 'signed_out' })
  const job = await loadCrewJob(me, key)
  if (job === null) return out(503, { error: 'try_later' })
  if (job === 'missing') return out(404, { error: 'not_your_job' })   // the phone drops it: the clean was taken off their list
  if (!job.jobId || job.status === 'booked') return out(409, { error: 'not_started' })

  const db = createAdminClient() as any
  const kind = job.kind === 'com' ? 'commercial' : job.kind === 'eol' ? 'eol' : 'residential'
  const owner = job.kind === 'com' ? job.clientId : parseKey(key)!.id
  const path = `${kind}/${owner}/${job.iso}/${job.jobId}/${id}.jpg`
  const have = await db.from('clean_photos').select('id, job_id').eq('id', id).maybeSingle()
  if (have.error) return out(503, { error: 'try_later' })
  if (have.data && have.data.job_id !== job.jobId) return out(409, { error: 'clash' })

  if (op === 'sign') {
    if (have.data) return out(200, { already: true })
    if (job.status === 'done') {
      const n = await db.from('clean_photos').select('id', { count: 'exact', head: true }).eq('job_id', job.jobId)
      if ((n.count ?? 0) >= 40) return out(409, { error: 'full' })
    }
    const s = await db.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: true })
    if (s.error || !s.data?.signedUrl) return out(503, { error: 'try_later' })
    return out(200, { url: s.data.signedUrl })
  }

  if (op === 'done') {
    if (have.data) return out(200, { ok: true })
    const t = Date.parse(String(b?.takenAt || ''))
    const row = {
      id, job_id: job.jobId, cleaner_id: me.profileId, client_id: job.kind === 'com' ? job.clientId : null, home_id: job.kind === 'com' ? null : owner,
      kind, clean_date: job.iso, taken_at: isNaN(t) ? null : new Date(t).toISOString(), path,
    }
    const ins = await db.from('clean_photos').insert(row)
    if (ins.error && !/duplicate|unique/i.test(ins.error.message || '')) return out(503, { error: 'try_later' })
    return out(200, { ok: true })
  }

  // remove: only before the clean is finished
  if (job.status === 'done') return out(409, { error: 'finished' })
  if (have.data) {
    const rm = await db.storage.from(BUCKET).remove([path])
    if (rm.error) return out(503, { error: 'try_later' })
    await db.from('clean_photos').delete().eq('id', id)
  }
  return out(200, { ok: true })
}
