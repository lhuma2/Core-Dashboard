import { CommercialHead } from '@/components/hub/CommercialHead'
import { DocumentsTab } from '@/components/hub/DocumentsTab'
import { brisbaneToday } from '@/lib/hub/figures'
import { loadDocs, loadProps } from '@/lib/hub/documents-data'
import { DOC_CHIPS, PROP_CHIPS } from '@/lib/hub/proposals'

export const dynamic = 'force-dynamic'

export default async function DocumentsPage({ searchParams }: { searchParams: { sec?: string; f?: string; q?: string } }) {
  const [props, docs] = await Promise.all([loadProps(), loadDocs()])
  const sec = searchParams.sec === 'agreements' ? 'agreements' : 'proposals'
  const f = String(searchParams.f || '')
  const propF = PROP_CHIPS.some(([v]) => v === f) ? (f as any) : 'all'
  const docF = DOC_CHIPS.some(([v]) => v === f) ? (f as any) : 'all'
  return (
    <>
      <CommercialHead tab="documents" />
      {props && docs
        ? <DocumentsTab sec={sec} props={props} docs={docs} today={brisbaneToday()} propF={sec === 'proposals' ? propF : 'all'} docF={sec === 'agreements' ? docF : 'all'} docQ={String(searchParams.q || '').slice(0, 100)} />
        : <p className="err" role="alert">Documents couldn’t load just now. Refresh the page to try again.</p>}
    </>
  )
}
