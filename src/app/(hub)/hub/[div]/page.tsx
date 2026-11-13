import { redirect } from 'next/navigation'
import { asDiv, divBase, divFromSlug } from '@/lib/hub/div'

// Each division opens on its Clients tab.
export default function DivPage({ params }: { params: { div: string } }) { redirect(divBase(asDiv(divFromSlug(params.div))) + '/clients') }
