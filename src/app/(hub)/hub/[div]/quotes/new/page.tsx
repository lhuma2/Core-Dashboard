import { asDiv, divFromSlug } from '@/lib/hub/div'
import { QuoteEditor } from '@/components/hub/QuoteEditor'
import { brisbaneToday } from '@/lib/hub/figures'
import { blankEolQuote, blankQuote } from '@/lib/hub/home-quotes'
import { loadHome } from '@/lib/hub/homes-data'

export const dynamic = 'force-dynamic'

// A blank quote for a phone enquiry. Its ref is given when it is first saved.
// From a client's page (?home=<id>) it opens with that client's details filled in.
export default async function NewQuotePage({ params, searchParams }: { params: { div: string }; searchParams: { home?: string } }) {
  const div = asDiv(divFromSlug(params.div))
  const today = brisbaneToday()
  const q = div === 'eol' ? blankEolQuote(today) : blankQuote(today)
  const id = searchParams.home && /^[0-9a-f-]{36}$/.test(searchParams.home) ? searchParams.home : ''
  const r = id ? await loadHome(id, div) : null
  if (r && r !== 'missing') {
    const h = r.h
    q.forHome = h.id
    q.name = h.name || ''; q.email = h.email || ''; q.phone = h.phone || ''
    q.street = h.street || ''; q.suburb = h.suburb || ''; q.postcode = h.postcode || ''
    q.beds = Math.min(Math.max(Number(h.beds) || 0, 0), 7); q.baths = Math.min(Math.max(Number(h.baths) || 0, 0), 7)
    if (div === 'res' && h.kind === 'recurring' && (h.every === 'weekly' || h.every === 'fortnightly' || h.every === 'monthly')) q.every = h.every
  }
  return <QuoteEditor initial={q} today={today} from={r && r !== 'missing' ? 'client' : 'list'} />
}
