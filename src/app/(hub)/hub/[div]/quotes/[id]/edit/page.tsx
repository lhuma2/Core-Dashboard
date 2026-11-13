import { asDiv, divBase, divFromSlug, DIVN } from '@/lib/hub/div'
import Link from 'next/link'
import { QuoteEditor } from '@/components/hub/QuoteEditor'
import { Back } from '@/components/hub/icons'
import { brisbaneToday } from '@/lib/hub/figures'
import { loadQuote } from '@/lib/hub/quotes-data'

export const dynamic = 'force-dynamic'

export default async function EditQuotePage({ params, searchParams }: { params: { id: string; div: string }; searchParams: { from?: string } }) {
  const div = asDiv(divFromSlug(params.div)), base = divBase(div)
  const q = await loadQuote(params.id, div)
  if (q === null || q === 'missing' || q.status === 'accepted' || q.status === 'declined') {
    const text = q === null ? 'The quote couldn’t load just now. Refresh the page to try again.'
      : q === 'missing' ? 'That quote was deleted.'
        : `${q.ref} was ${q.status} by the client, so it can’t be changed.`
    return <><Link className="back" href={base + '/quotes'}><Back /> Quotes</Link><p className="err" role="alert">{text}</p></>
  }
  return <QuoteEditor initial={q} today={brisbaneToday()} from={searchParams.from === 'view' ? 'view' : 'list'} />
}
