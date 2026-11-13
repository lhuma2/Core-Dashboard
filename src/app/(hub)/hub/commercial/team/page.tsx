import { CommercialHead } from '@/components/hub/CommercialHead'
import { CommercialTeam } from '@/components/hub/CommercialTeam'
import { brisbaneToday } from '@/lib/hub/figures'
import { loadCommercialTeam } from '@/lib/hub/team-data'

export const dynamic = 'force-dynamic'

export default async function CommercialTeamPage() {
  const rows = await loadCommercialTeam(brisbaneToday())
  return (
    <>
      <CommercialHead tab="team" />
      {rows
        ? <CommercialTeam rows={rows} />
        : <p className="err" role="alert">The team couldn’t load just now. Refresh the page to try again.</p>}
    </>
  )
}
