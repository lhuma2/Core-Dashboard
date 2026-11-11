import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Back } from '@/components/hub/icons'
import { NewClientForm, type TeamMember } from '@/components/hub/NewClientForm'
import { brisbaneToday } from '@/lib/hub/figures'

export const dynamic = 'force-dynamic'

export default async function NewClientPage() {
  const supabase = createClient() as any
  const [teamQ, clientsQ] = await Promise.all([
    supabase.from('profiles').select('id, full_name, region, is_team_leader, pack_signed_at').eq('role', 'cleaner'),
    supabase.from('clients').select('business_name, status, resume_on'),
  ])
  const failed = teamQ.error || clientsQ.error
  const team: TeamMember[] = (teamQ.data ?? []).map((t: any) => ({ id: t.id, name: t.full_name ?? 'Unnamed cleaner', region: t.region, leader: !!t.is_team_leader, signed: !!t.pack_signed_at }))
  const existing = (clientsQ.data ?? []).map((c: any) => ({ name: c.business_name ?? '', status: c.status, resume_on: c.resume_on }))
  return (
    <>
      <Link className="back" href="/hub/commercial"><Back /> Commercial</Link>
      <h1 className="greet">New client</h1>
      {failed
        ? <p className="err" role="alert">The form couldn’t load just now. Refresh the page to try again.</p>
        : <NewClientForm team={team} existing={existing} today={brisbaneToday()} />}
    </>
  )
}
