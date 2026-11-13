import { asDiv, divBase, divFromSlug, DIVN } from '@/lib/hub/div'
import { QuoteEditor } from '@/components/hub/QuoteEditor'
import { brisbaneToday } from '@/lib/hub/figures'
import { blankEolQuote, blankQuote } from '@/lib/hub/home-quotes'

export const dynamic = 'force-dynamic'

// A blank General Maintenance quote for a phone enquiry. Its ref is given when it is first saved.
export default function NewQuotePage({ params }: { params: { div: string } }) {
  const div = asDiv(divFromSlug(params.div)), base = divBase(div)
  const today = brisbaneToday()
  return <QuoteEditor initial={div === 'eol' ? blankEolQuote(today) : blankQuote(today)} today={today} from="list" />
}
