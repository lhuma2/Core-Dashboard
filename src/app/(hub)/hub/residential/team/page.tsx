import { ResidentialHead } from '@/components/hub/ResidentialHead'
import { HomeTeam } from '@/components/hub/HomeTeam'
import { loadCleaners, loadHomes } from '@/lib/hub/homes-data'
import { loadQuotes, toDoCount } from '@/lib/hub/quotes-data'
import { brisbaneToday } from '@/lib/hub/figures'
import { teamData } from '@/lib/hub/homes'

export const dynamic = 'force-dynamic'

export default async function ResidentialTeamPage() {
  const [homes, cleaners, quotes] = await Promise.all([loadHomes(), loadCleaners(), loadQuotes()])
  const t = homes ? teamData(homes, cleaners, brisbaneToday()) : null
  return (
    <>
      <ResidentialHead tab="team" quotesToDo={quotes ? toDoCount(quotes) : 0} />
      {t
        ? <HomeTeam rows={t.rows} unassigned={t.unassigned} />
        : <p className="err" role="alert">The team couldn’t load just now. Refresh the page to try again.</p>}
    </>
  )
}
