import { createAdminClient } from '@/lib/supabase/admin'
import { QuoteDocument } from '@/components/hub/QuoteDocument'
import { QuoteClientPanel } from '@/components/hub/QuoteClientPanel'
import { brisbaneToday } from '@/lib/hub/figures'
import { isoAdd, quoteDoc, quoteOf, QUOTE_COLS, type QuoteRow } from '@/lib/hub/home-quotes'
import '../../(hub)/hub/hub.css'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Your quote from Core Cleaning', robots: { index: false, follow: false } }

// The client's own quote page, opened from the link in their email. Matched by the quote's private code.
export default async function ClientQuotePage({ params }: { params: { code: string } }) {
  const shell = (body: React.ReactNode) => (
    <div className="hub">
      <header className="top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo" src="/hub-logo-white.png" alt="Core Cleaning" />
      </header>
      <main className="wrap pubwrap">{body}</main>
    </div>
  )
  const bad = shell(<div className="addcard pubdone"><h1 className="nch">This quote link isn’t valid</h1><p className="nchint">The link may be mistyped or the quote was withdrawn. Please contact Core Cleaning on 0407 026 360 or admin@corecleaning.services for a fresh link.</p></div>)
  if (!/^[0-9a-f]{64}$/.test(params.code || '')) return bad
  const db = createAdminClient() as any
  const { data } = await db.from('home_quotes').select(QUOTE_COLS).eq('code', params.code).maybeSingle()
  if (!data) return bad
  const q = quoteOf(data as QuoteRow)
  if (q.status === 'draft') return bad
  const today = brisbaneToday()
  const closed = q.status === 'accepted' ? 'You accepted this quote. Thank you.'
    : q.status === 'declined' ? 'This quote was declined.'
      : q.status === 'changes' ? 'This quote is being updated. You’ll get the new one by email.' : ''
  return shell(
    <QuoteClientPanel code={params.code} open={q.status === 'sent'} closedText={closed} oneOff={q.every === 'oneoff'} minDate={isoAdd(today, 1)}
      initial={{ street: q.street, suburb: q.suburb, postcode: q.postcode, start: q.start && q.start > today ? q.start : '' }}>
      <QuoteDocument d={quoteDoc(q, today)} />
    </QuoteClientPanel>
  )
}
