import Link from 'next/link'
import { redirect } from 'next/navigation'
import { clientMe } from '@/lib/clientapp/data'
import { SWMS_LIST, POLICIES, MODERN_SLAVERY } from '@/lib/documents/safety'

const Back = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>

/** Compliance pack: our Safe Work Method Statements and policies. Each opens as a printable page. */
export default async function ClientCompliancePage() {
  const me = await clientMe()
  if (!me) redirect('/client/login')
  const docs = [
    ...SWMS_LIST.map(s => ({ slug: s.code.replace(/\s+/g, '-').toLowerCase(), title: s.title, sub: 'Safe Work Method Statement · ' + s.code })),
    ...POLICIES.map(p => ({ slug: p.slug, title: p.title, sub: 'Policy · ' + p.code })),
    { slug: 'modern-slavery', title: MODERN_SLAVERY.title, sub: 'Policy statement' },
  ]
  return (
    <>
      <Link className="back" href="/client/app?tab=docs"><Back /> Documents</Link>
      <h1 className="h1">Compliance pack</h1>
      <p className="hint" style={{ margin: '0 0 12px' }}>How we work safely on your site. Every cleaner is checked, trained and approved before they start.</p>
      <div className="jobs">
        {docs.map(d => <div className="row" key={d.slug}><span className="jmain"><span className="jname">{d.title}</span><span className="jsub">{d.sub}</span></span><a className="btn ghost sm" href={'/compliance/' + d.slug} target="_blank" rel="noopener" aria-label={'View ' + d.title}>View</a></div>)}
      </div>
    </>
  )
}
