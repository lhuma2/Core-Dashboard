import { notFound } from 'next/navigation'
import { DocArticle } from '@/components/hub/DocArticle'
import { DocTop } from '@/components/hub/DocTop'
import { docBySlug, docFileName, docSlug } from '@/lib/hub/compliance-docs'

export const dynamic = 'force-dynamic'

/** One compliance document. ?from=team-<cleaner id> comes back to that cleaner's signed pack. */
export default function ComplianceDocPage({ params, searchParams }: { params: { doc: string }; searchParams: { from?: string } }) {
  const d = docBySlug(params.doc)
  if (!d) notFound()
  const m = /^team-([0-9a-f-]{36})$/i.exec(searchParams.from || '')
  const back = m ? { href: `/hub/team/${m[1]}`, label: 'Signed pack' } : { href: '/hub/compliance', label: 'Compliance pack' }
  return (
    <>
      <DocTop back={back} id={m ? null : d.id} />
      <DocArticle d={d} pdfHref={`/hub/compliance/${docSlug(d.id)}/pdf`} fileName={docFileName(d)} />
    </>
  )
}
