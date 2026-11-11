import { ResidentialHead } from '@/components/hub/ResidentialHead'
import { QuoteList } from '@/components/hub/QuoteList'
import { loadQuotes, toDoCount } from '@/lib/hub/quotes-data'

export const dynamic = 'force-dynamic'

const SHOWS = ['open', 'sent', 'closed', 'all'] as const

export default async function QuotesPage({ searchParams }: { searchParams: { show?: string } }) {
  const list = await loadQuotes()
  const show = (SHOWS as readonly string[]).includes(searchParams.show ?? '') ? (searchParams.show as (typeof SHOWS)[number]) : 'open'
  return (
    <>
      <ResidentialHead tab="quotes" quotesToDo={list ? toDoCount(list) : 0} />
      {list
        ? <QuoteList quotes={list} initial={show} />
        : <p className="err" role="alert">The quotes couldn’t load just now. Refresh the page to try again.</p>}
    </>
  )
}
