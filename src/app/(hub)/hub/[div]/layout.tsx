import { notFound } from 'next/navigation'
import { divFromSlug } from '@/lib/hub/div'

// /hub/residential/… and /hub/end-of-lease/… share these screens. Anything else is not a page.
export default function DivLayout({ children, params }: { children: React.ReactNode; params: { div: string } }) {
  if (!divFromSlug(params.div)) notFound()
  return <>{children}</>
}
