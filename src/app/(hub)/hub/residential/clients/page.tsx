import { ResidentialHead } from '@/components/hub/ResidentialHead'
import { HomeList } from '@/components/hub/HomeList'
import { loadCleaners, loadHomes } from '@/lib/hub/homes-data'
import { loadQuotes, toDoCount } from '@/lib/hub/quotes-data'
import { brisbaneToday } from '@/lib/hub/figures'
import { homeRow } from '@/lib/hub/homes'

export const dynamic = 'force-dynamic'
const VIEWS = ['recurring', 'oneoff', 'past'] as const

export default async function ResidentialClientsPage({ searchParams }: { searchParams: { show?: string } }) {
  const [homes, cleaners, quotes] = await Promise.all([loadHomes(), loadCleaners(), loadQuotes()])
  const today = brisbaneToday()
  const name = (id: string | null) => { const c = cleaners.find(x => x.id === id); return c ? c.name.split(/\s+/)[0] : 'Unassigned' }
  const show = (VIEWS as readonly string[]).includes(searchParams.show ?? '') ? (searchParams.show as (typeof VIEWS)[number]) : 'recurring'
  return (
    <>
      <ResidentialHead tab="clients" quotesToDo={quotes ? toDoCount(quotes) : 0} />
      {homes
        ? <HomeList rows={homes.map(h => homeRow(h, today, name))} initial={show} />
        : <p className="err" role="alert">The clients couldn’t load just now. Refresh the page to try again.</p>}
    </>
  )
}
