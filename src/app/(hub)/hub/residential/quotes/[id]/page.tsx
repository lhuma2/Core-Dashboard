import Link from 'next/link'
import { QuoteDocument } from '@/components/hub/QuoteDocument'
import { QuoteAdminBar } from '@/components/hub/QuoteAdminBar'
import { Back } from '@/components/hub/icons'
import { brisbaneToday } from '@/lib/hub/figures'
import { loadQuote } from '@/lib/hub/quotes-data'
import { Q_STATE, qMeta, quoteDoc } from '@/lib/hub/home-quotes'

export const dynamic = 'force-dynamic'

export default async function QuoteViewPage({ params }: { params: { id: string } }) {
  const q = await loadQuote(params.id)
  const back = <Link className="back" href="/hub/residential/quotes"><Back /> Quotes</Link>
  if (q === null) return <>{back}<p className="err" role="alert">The quote couldn’t load just now. Refresh the page to try again.</p></>
  if (q === 'missing') return <>{back}<p className="err" role="alert">That quote was deleted.</p></>
  const cls = 'agstatus' + (q.status === 'sent' ? ' wait' : q.status === 'accepted' ? ' ok' : q.status === 'changes' ? ' warn' : '')
  return (
    <>
      {back}
      <QuoteAdminBar id={q.id!} code={q.code!} status={q.status} email={q.email} statusText={Q_STATE[q.status][0] + ' · ' + qMeta(q)} statusCls={cls} />
      <QuoteDocument d={quoteDoc(q, brisbaneToday())} />
    </>
  )
}
