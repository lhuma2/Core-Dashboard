import { CommercialHead } from '@/components/hub/CommercialHead'
import { ClientList } from '@/components/hub/ClientList'
import { brisbaneToday } from '@/lib/hub/figures'
import { loadCommercial } from '@/lib/hub/commercial-data'

export const dynamic = 'force-dynamic'

export default async function CommercialPage({ searchParams }: { searchParams: { show?: string; q?: string } }) {
  const data = await loadCommercial(brisbaneToday())
  const show = searchParams.show === 'paused' || searchParams.show === 'ended' ? searchParams.show : 'active'
  return (
    <>
      <CommercialHead tab="clients" />
      {data
        ? <ClientList rows={data.rows} initial={show} initialQuery={searchParams.q ?? ''} />
        : <p className="err" role="alert">The clients couldn’t load just now. Refresh the page to try again.</p>}
    </>
  )
}
