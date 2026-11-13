import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Back } from '@/components/hub/icons'
import { NewClientForm, type TeamMember } from '@/components/hub/NewClientForm'
import { brisbaneToday } from '@/lib/hub/figures'
import { loadProp } from '@/lib/hub/documents-data'
import { ncFromProp } from '@/lib/hub/proposals'

export const dynamic = 'force-dynamic'

export default async function NewClientPage({ searchParams }: { searchParams: { from?: string } }) {
  const supabase = createClient() as any
  const today = brisbaneToday()
  const from = searchParams.from && /^[0-9a-f-]{36}$/.test(searchParams.from) ? await loadProp(searchParams.from, supabase) : null
  const ready = from && from.status === 'accepted' && from.ptype === 'comm' && from.agr?.status === 'signed' && !from.setupClientId ? from : null
  let initial: ReturnType<typeof ncFromProp> | undefined
  if (ready) {
    const { data: a } = await supabase.from('agreements').select('details').eq('id', ready.agr!.id).maybeSingle()
    initial = ncFromProp(ready, a?.details || null, today)
  }
  const [teamQ, clientsQ] = await Promise.all([
    supabase.from('profiles').select('id, full_name, region, is_team_leader, pack_signed_at').eq('role', 'cleaner'),
    supabase.from('clients').select('business_name, status, resume_on'),
  ])
  const failed = teamQ.error || clientsQ.error
  const team: TeamMember[] = (teamQ.data ?? []).map((t: any) => ({ id: t.id, name: t.full_name ?? 'Unnamed cleaner', region: t.region, leader: !!t.is_team_leader, signed: !!t.pack_signed_at }))
  const existing = (clientsQ.data ?? []).map((c: any) => ({ name: c.business_name ?? '', status: c.status, resume_on: c.resume_on }))
  return (
    <>
      <Link className="back" href={from ? '/hub/commercial/documents' : '/hub/commercial'}><Back /> {from ? 'Documents' : 'Commercial'}</Link>
      <h1 className="greet">New client</h1>
      {ready && <p className="agstatus ok">Filled in from proposal {ready.ref} and their signed agreement. Prices are converted to ex GST. Check the days and times, then add the cleaner costs and cleaners, and save.</p>}
      {from && !ready && <p className="agstatus warn">{from.setupClientId ? `${from.ref} is already set up as a client.` : `${from.ref} can’t be set up as a client until it’s accepted and the agreement is signed.`}</p>}
      {failed
        ? <p className="err" role="alert">The form couldn’t load just now. Refresh the page to try again.</p>
        : <NewClientForm team={team} existing={existing} today={today} initial={initial} fromProp={ready ? ready.id : null} />}
    </>
  )
}
