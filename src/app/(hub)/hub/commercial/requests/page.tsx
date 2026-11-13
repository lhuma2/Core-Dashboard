import { CommercialHead } from '@/components/hub/CommercialHead'
import { RequestList } from '@/components/hub/RequestList'
import { brisbaneToday } from '@/lib/hub/figures'
import { loadRequests } from '@/lib/hub/requests-data'
import { rqNeedsYou } from '@/lib/hub/requests'

export const dynamic = 'force-dynamic'

export default async function RequestsPage({ searchParams }: { searchParams: { show?: string; q?: string } }) {
  const list = await loadRequests()
  const show = searchParams.show === 'done' || searchParams.show === 'all' ? searchParams.show : 'open'
  return (
    <>
      <CommercialHead tab="requests" requests={list ? list.filter(rqNeedsYou).length : 0} />
      {list
        ? <RequestList requests={list} today={brisbaneToday()} initial={show} initialQuery={searchParams.q ?? ''} />
        : <p className="err" role="alert">The requests couldn’t load just now. Refresh the page to try again.</p>}
    </>
  )
}
