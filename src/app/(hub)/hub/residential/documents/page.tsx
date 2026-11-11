import { ResidentialHead } from '@/components/hub/ResidentialHead'
import { DocList } from '@/components/hub/DocList'
import { loadDocs, loadHomePicks } from '@/lib/hub/docs-data'
import { loadQuotes, toDoCount } from '@/lib/hub/quotes-data'

export const dynamic = 'force-dynamic'

const SHOWS = ['all', 'draft', 'sent', 'signed'] as const

export default async function DocumentsPage({ searchParams }: { searchParams: { show?: string } }) {
  const [docs, homes, quotes] = await Promise.all([loadDocs(), loadHomePicks(), loadQuotes()])
  const show = (SHOWS as readonly string[]).includes(searchParams.show ?? '') ? (searchParams.show as (typeof SHOWS)[number]) : 'all'
  return (
    <>
      <ResidentialHead tab="documents" quotesToDo={quotes ? toDoCount(quotes) : 0} />
      {docs
        ? <DocList docs={docs} homes={homes} initial={show} />
        : <p className="err" role="alert">The documents couldn’t load just now. Refresh the page to try again.</p>}
    </>
  )
}
