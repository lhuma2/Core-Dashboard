import Link from 'next/link'
import { redirect } from 'next/navigation'
import { clientMe } from '@/lib/clientapp/data'
import { COMPLIANCE_DOCS, GROUP_ORDER, docSlug } from '@/lib/hub/compliance-docs'

const Back = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>

const KIND = ['Safe Work Method Statement', 'Policy', '', 'Insurance', 'ABN registration']

/** Compliance pack: our Safe Work Method Statements and policies. Each opens as a printable page. */
export default async function ClientCompliancePage() {
  const me = await clientMe()
  if (!me) redirect('/client/login')
  // the client pack: everything but the subcontractor agreement and induction (group 2), in the hub's order
  const docs = GROUP_ORDER.filter(g => g !== 2).flatMap(g => COMPLIANCE_DOCS.filter(d => d.group === g))
    .map(d => ({ slug: docSlug(d.id), title: d.title, sub: KIND[d.group] + ' · ' + d.code }))
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
