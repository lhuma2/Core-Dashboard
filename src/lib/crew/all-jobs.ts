import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { firstName, type CrewJob } from './jobs'
import { loadCrewJobs, type Me } from './data'

/** Every cleaner's cleans in a date range, the same way their cleaner app shows them (for the daily reminders and the
 *  Monday report). A clean with more than one cleaner shows once for each of them. */
export async function allCrewJobs(from: string, days: number): Promise<{ me: Me; jobs: CrewJob[] }[]> {
  const db = createAdminClient() as any
  const { data: profs } = await db.from('profiles').select('id, user_id, full_name, email, password_set_at').eq('role', 'cleaner')
  const out: { me: Me; jobs: CrewJob[] }[] = []
  for (const p of profs ?? []) {
    if (!p.user_id) continue
    const name = (p.full_name || '').trim() || 'Cleaner'
    const me: Me = { userId: p.user_id, profileId: p.id, name, first: firstName(name) || 'there', email: p.email || '', pwSet: !!p.password_set_at }
    const jobs = await loadCrewJobs(me, from, days)
    if (jobs?.length) out.push({ me, jobs })
  }
  return out
}
