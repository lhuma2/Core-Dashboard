import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { brisbaneToday } from './figures'
import { isoAdd } from './timetable'

export interface PhotoItem { id: string; url: string; save: string; label: string }
export interface PhotoDay { jobId: string; iso: string; cleaner: string; finished: string | null; photos: PhotoItem[]; pending: number; ack: boolean; need: number }

const BUCKET = 'clean-photos'
const clock = (ts: string) => new Intl.DateTimeFormat('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Australia/Brisbane' }).format(new Date(ts)).replace(/\s/g, '').toLowerCase()

/** Completion photos for one home (or commercial client), one block per clean, newest first, only the ones still kept
 *  (7 days after the clean, 21 for End of Lease). Links are signed for an hour; the bucket itself is private. */
export async function loadPhotos(o: { homeId?: string; clientId?: string; keep: number; fileName: string }): Promise<PhotoDay[] | null> {
  const db = createAdminClient() as any
  const after = isoAdd(brisbaneToday(), -o.keep)
  const col = o.homeId ? 'home_id' : 'client_id', id = o.homeId || o.clientId
  const [jobsQ, phQ] = await Promise.all([
    db.from('jobs').select('id, clean_date, status, finished_at, photo_count, photo_ack, photos_needed').eq(col, id).gt('clean_date', after),
    db.from('clean_photos').select('id, job_id, clean_date, taken_at, path, cleaner_id').eq(col, id).gt('clean_date', after),
  ])
  if (jobsQ.error || phQ.error) return null
  const jobs: any[] = (jobsQ.data || []).filter((j: any) => j.status === 'done' || (phQ.data || []).some((p: any) => p.job_id === j.id))
  if (!jobs.length) return []
  const crewQ = await db.from('job_cleaners').select('job_id, cleaner:profiles(full_name)').in('job_id', jobs.map(j => j.id))
  const crew = new Map<string, string[]>()
  for (const c of (crewQ.data || []) as any[]) if (c.cleaner?.full_name) crew.set(c.job_id, [...(crew.get(c.job_id) || []), c.cleaner.full_name])

  const photos: any[] = (phQ.data || []).sort((a: any, b: any) => String(a.taken_at || '').localeCompare(String(b.taken_at || '')) || String(a.id).localeCompare(String(b.id)))
  const signed = new Map<string, string>()
  if (photos.length) {
    const s = await db.storage.from(BUCKET).createSignedUrls(photos.map(p => p.path), 3600)
    for (const x of (s.data || []) as any[]) if (x.signedUrl && x.path) signed.set(x.path, x.signedUrl)
  }
  const days: PhotoDay[] = jobs.map(j => {
    const iso = String(j.clean_date).slice(0, 10)
    const mine = photos.filter(p => p.job_id === j.id)
    const list = mine.map((p, i) => {
      const url = signed.get(p.path) || ''
      const file = `${o.fileName}-${iso}-photo-${i + 1}.jpg`
      return { id: p.id, url, save: url ? url + (url.includes('?') ? '&' : '?') + 'download=' + encodeURIComponent(file) : '', label: 'Photo ' + (i + 1) + (p.taken_at ? ' · ' + clock(p.taken_at) : '') }
    })
    return {
      jobId: j.id, iso, cleaner: (crew.get(j.id) || []).join(', '), finished: j.finished_at ? clock(j.finished_at) : null, photos: list,
      pending: j.status === 'done' ? Math.max(0, (j.photo_count || 0) - mine.length) : 0, ack: !!j.photo_ack, need: j.photos_needed || 3,
    }
  })
  return days.sort((a, b) => (a.iso < b.iso ? 1 : a.iso > b.iso ? -1 : 0))
}
