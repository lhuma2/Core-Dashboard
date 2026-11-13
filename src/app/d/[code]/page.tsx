import Link from 'next/link'
import { PubShell, BadLink } from '@/components/hub/PubShell'
import { sharedDocs } from '@/lib/hub/compliance-share'
import { docFileName, docSlug } from '@/lib/hub/compliance-docs'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Compliance documents from Core Cleaning', robots: { index: false, follow: false } }

const Chev = () => <svg className="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
const Dl = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v12M7 11l5 5 5-5M5 20h14" /></svg>

// What someone sees when Laith shares compliance documents with them. Words from the mock-up.
export default async function SharedDocsPage({ params, searchParams }: { params: { code: string }; searchParams: { preview?: string } }) {
  const docs = await sharedDocs(params.code)
  if (!docs) return <PubShell><BadLink what="documents" /></PubShell>
  const q = searchParams.preview === '1' ? '?preview=1' : ''
  return (
    <PubShell>
      {q && (
        <div className="previewnote">
          <span>Preview: this is what the person you send the link to sees.</span>
          <Link className="back" href="/hub/compliance">Back to your hub</Link>
        </div>
      )}
      <article className="doc">
        <div className="dochead">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="doclogo" src="/hub-logo-white.png" alt="Core Cleaning" />
          <div><div className="doccode">Shared with you by Core Cleaning</div><h1 className="doctitle">Compliance documents</h1></div>
        </div>
        <p className="dp">Hi, here are the documents you asked for. Tap one to read it, download each one as its own PDF, or download them all as one PDF.</p>
        <div className="list sharedlist">
          {docs.map(d => (
            <div className="sdrow" key={d.id}>
              <Link className="drow" href={`/d/${params.code}/${docSlug(d.id)}${q}`}><span className="dcode">{d.code}</span><span className="dtitle">{d.title}</span><Chev /></Link>
              <a className="btn log sddl" href={d.pdf || `/d/${params.code}/${docSlug(d.id)}/pdf`} download={docFileName(d)} aria-label={`Download ${d.code} ${d.title} as a PDF`}><Dl />PDF</a>
            </div>
          ))}
        </div>
        <a className="btn call dlall" href={`/d/${params.code}/pdf`} download="Core Cleaning compliance documents.pdf"><Dl />Download all as PDF</a>
        <p className="dp small">Core Cleaning · ABN 45 344 135 153 · 0407 026 360 · contact@corecleaning.services</p>
      </article>
    </PubShell>
  )
}
