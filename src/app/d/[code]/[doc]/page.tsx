import Link from 'next/link'
import { PubShell, BadLink } from '@/components/hub/PubShell'
import { DocArticle } from '@/components/hub/DocArticle'
import { Back } from '@/components/hub/icons'
import { sharedDocs } from '@/lib/hub/compliance-share'
import { docFileName, docSlug } from '@/lib/hub/compliance-docs'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Compliance document from Core Cleaning', robots: { index: false, follow: false } }

export default async function SharedDocPage({ params, searchParams }: { params: { code: string; doc: string }; searchParams: { preview?: string } }) {
  const docs = await sharedDocs(params.code)
  const d = docs?.find(x => docSlug(x.id) === String(params.doc).toLowerCase())
  if (!d) return <PubShell><BadLink what="document" /></PubShell>
  const q = searchParams.preview === '1' ? '?preview=1' : ''
  return (
    <PubShell>
      {docs!.length > 1 && <Link className="back" href={`/d/${params.code}${q}`}><Back /> All documents</Link>}
      <DocArticle d={d} pdfHref={`/d/${params.code}/${docSlug(d.id)}/pdf`} fileName={docFileName(d)} />
    </PubShell>
  )
}
