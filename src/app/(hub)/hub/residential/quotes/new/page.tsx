import { QuoteEditor } from '@/components/hub/QuoteEditor'
import { brisbaneToday } from '@/lib/hub/figures'
import { blankQuote } from '@/lib/hub/home-quotes'

export const dynamic = 'force-dynamic'

// A blank General Maintenance quote for a phone enquiry. Its ref is given when it is first saved.
export default function NewQuotePage() {
  const today = brisbaneToday()
  return <QuoteEditor initial={blankQuote(today)} today={today} from="list" />
}
