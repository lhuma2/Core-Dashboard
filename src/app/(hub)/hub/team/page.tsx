import Link from 'next/link'
import { Back } from '@/components/hub/icons'
import { TeamList } from '@/components/hub/TeamList'
import { loadTeam } from '@/lib/hub/team-data'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function TeamPage({ searchParams }: { searchParams: { show?: string } }) {
  const team = await loadTeam()
  const back = <Link className="back" href="/hub"><Back /> Dashboard</Link>
  if (!team) return <>{back}<h1 className="greet">Team</h1><p className="err" role="alert">The team couldn’t load just now. Refresh the page to try again.</p></>
  // private links for "See what they get" (packs not signed yet)
  const ids = team.filter(c => c.kind === 'k').map(c => c.id)
  const tokens: Record<string, string> = {}
  if (ids.length) {
    const { data } = await (createClient() as any).from('cleaner_packs').select('id, token').in('id', ids)
    for (const k of (data || []) as any[]) tokens[k.id] = k.token
  }
  const s = searchParams.show
  const initial = s === 'north' || s === 'south' || s === 'ipswich' || s === 'gold_coast' || s === 'none' ? s : 'all'
  return <>{back}<TeamList team={team} tokens={tokens} initial={initial} /></>
}
