import { asDiv, divBase, divFromSlug, DIVN } from '@/lib/hub/div'
import { ResidentialHead } from '@/components/hub/ResidentialHead'
import { DocList } from '@/components/hub/DocList'
import { loadDocs, loadHomePicks } from '@/lib/hub/docs-data'
import { loadQuotes, toDoCount } from '@/lib/hub/quotes-data'

export const dynamic = 'force-dynamic'

const SHOWS = ['all', 'draft', 'sent', 'signed'] as const

export default async function DocumentsPage({ params, searchParams }: { params: { div: string }; searchParams: { show?: string } }) {
  const div = asDiv(divFromSlug(params.div)), base = divBase(div)
  const [docs, homes, quotes] = await Promise.all([loadDocs(div), loadHomePicks(div), loadQuotes(div)])
  const show = (SHOWS as readonly string[]).includes(searchParams.show ?? '') ? (searchParams.show as (typeof SHOWS)[number]) : 'all'
  return (
    <>
      <ResidentialHead div={div} tab="documents" quotesToDo={quotes ? toDoCount(quotes) : 0} />
      {docs
        ? <DocList docs={docs} homes={homes} initial={show} />
        : <p className="err" role="alert">The documents couldn’t load just now. Refresh the page to try again.</p>}
    </>
  )
}
