import { createAdminClient } from '@/lib/supabase/admin'
import { fetchAustenderCandidates } from './sources/austender'
import { fetchQtendersCandidates } from './sources/qtenders'

export const ACTIVE_TARGET = 10
export const CANDIDATE_BUFFER_TARGET = 15

function brisbaneToday(): string {
  return new Date().toLocaleString('en-AU', {
    timeZone: 'Australia/Brisbane', year: 'numeric', month: '2-digit', day: '2-digit',
  }).split('/').reverse().join('-')
}

// Promotes the soonest-closing candidates to 'active' until the active pool
// reaches ACTIVE_TARGET (or candidates run out). Returns how many were promoted.
async function promoteCandidates(db: any, upTo: number): Promise<number> {
  if (upTo <= 0) return 0
  const { data: candidates } = await db
    .from('tenders')
    .select('id')
    .eq('status', 'candidate')
    .order('close_date', { ascending: true, nullsFirst: false })
    .limit(upTo)

  const ids = (candidates ?? []).map((c: any) => c.id)
  if (ids.length === 0) return 0

  await db.from('tenders')
    .update({ status: 'active', activated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .in('id', ids)

  return ids.length
}

// Full refresh: expire past-due active tenders, top up the active board from
// the candidate buffer, then re-fill the candidate buffer from both sources.
export async function refreshTenders(): Promise<{ expired: number; promoted: number; fetched: number; inserted: number }> {
  const db = createAdminClient() as any
  const today = brisbaneToday()

  const { data: expiredRows } = await db
    .from('tenders')
    .update({ status: 'done', updated_at: new Date().toISOString() })
    .eq('status', 'active')
    .lt('close_date', today)
    .select('id')
  const expired = (expiredRows ?? []).length

  const { count: activeCount } = await db
    .from('tenders').select('id', { count: 'exact', head: true }).eq('status', 'active')
  let promoted = await promoteCandidates(db, ACTIVE_TARGET - (activeCount ?? 0))

  const { count: candidateCount } = await db
    .from('tenders').select('id', { count: 'exact', head: true }).eq('status', 'candidate')
  const needed = CANDIDATE_BUFFER_TARGET - (candidateCount ?? 0)

  let fetched = 0
  let inserted = 0
  if (needed > 0) {
    const [austender, qtenders] = await Promise.allSettled([
      fetchAustenderCandidates(8),
      fetchQtendersCandidates(20),
    ])
    const found = [
      ...(austender.status === 'fulfilled' ? austender.value : []),
      ...(qtenders.status === 'fulfilled' ? qtenders.value : []),
    ]
    fetched = found.length

    // Skip anything already known (active, candidate, or previously ticked off / expired).
    const { data: known } = await db.from('tenders').select('source, external_id')
    const knownKeys = new Set((known ?? []).map((k: any) => `${k.source}:${k.external_id}`))
    const fresh = found.filter((t) => !knownKeys.has(`${t.source}:${t.external_id}`)).slice(0, needed)

    if (fresh.length > 0) {
      const { error } = await db.from('tenders').insert(
        fresh.map((t) => ({ ...t, status: 'candidate' }))
      )
      if (!error) inserted = fresh.length
    }

    const { count: activeCount2 } = await db
      .from('tenders').select('id', { count: 'exact', head: true }).eq('status', 'active')
    promoted += await promoteCandidates(db, ACTIVE_TARGET - (activeCount2 ?? 0))
  }

  return { expired, promoted, fetched, inserted }
}

// Ticks a tender off the board (marks it done) and immediately promotes the
// next best candidate to fill its spot, so the board stays at ACTIVE_TARGET
// without waiting for the next cron run.
export async function tickOffTender(id: string): Promise<{ error?: string }> {
  const db = createAdminClient() as any
  const { error } = await db.from('tenders')
    .update({ status: 'done', ticked_off_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }

  await promoteCandidates(db, 1)
  return {}
}
