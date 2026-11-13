import { notFound } from 'next/navigation'
import { PubShell } from '@/components/hub/PubShell'
import { DocArticle } from '@/components/hub/DocArticle'
import { docFileName, publicDoc } from '@/lib/hub/compliance-docs'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Compliance document from Core Cleaning', robots: { index: false, follow: false } }

// Public view of one compliance document, from the same library as the hub's Compliance pack. Linked from the client
// portal and the subcontractor pack. The subcontractor agreement and induction are not public: those are on the
// private signing page.
export default function PublicComplianceDocPage({ params }: { params: { slug: string } }) {
  const d = publicDoc(params.slug)
  if (!d) notFound()
  return (
    <PubShell>
      <DocArticle d={d} pdfHref={`/compliance/${params.slug.toLowerCase()}/pdf`} fileName={docFileName(d)} />
    </PubShell>
  )
}
