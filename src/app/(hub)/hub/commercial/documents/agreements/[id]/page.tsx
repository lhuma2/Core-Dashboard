import Link from 'next/link'
import { Back } from '@/components/hub/icons'
import { AgreementHead } from '@/components/hub/AgreementBody'
import { AgreementViewBar } from '@/components/hub/AgreementViewBar'
import { brisbaneToday } from '@/lib/hub/figures'
import { clientSnapFor } from '@/lib/hub/documents-data'
import { createClient } from '@/lib/supabase/server'
import { AGR_COLS, agrOf, agrState, agView, detailsList, dLong } from '@/lib/hub/proposals'

export const dynamic = 'force-dynamic'

export default async function CommAgreementPage({ params }: { params: { id: string } }) {
  const back = <Link className="back" href="/hub/commercial/documents?sec=agreements"><Back /> Documents</Link>
  if (!/^[0-9a-f-]{36}$/.test(params.id)) return <>{back}<p className="err" role="alert">That agreement was deleted.</p></>
  const db = createClient() as any
  const { data, error } = await db.from('agreements').select(AGR_COLS).eq('id', params.id).maybeSingle()
  if (error) return <>{back}<p className="err" role="alert">The agreement couldn’t load just now. Refresh the page to try again.</p></>
  if (!data) return <>{back}<p className="err" role="alert">That agreement was deleted.</p></>
  const d = agrOf(data), today = brisbaneToday()
  // a draft made from a client record reads their page live until it's sent
  const live = d.status === 'draft' && d.clientId && !d.snap?.prop ? await clientSnapFor(d.clientId, db) : null
  const v = agView(d, today, d.details, live)
  const ds = agrState(d, today), spec = d.atype === 'spec'
  const status = spec && d.status === 'signed' ? `Signed by ${d.signedBy} on ${dLong(d.signedAt)}. The works are booked in the timetable for ${dLong(d.start)}.`
    : ds.key === 'draft' ? 'Draft. Not sent yet.' + (live ? ` It reads from ${d.client}’s page, so any change there shows here. It’s locked in when you send it.` : '')
      : ds.key === 'sent' ? `Sent to ${d.sentTo} on ${dLong(d.sentAt)}. Waiting for their signature.`
        : `Signed by ${d.signedBy} on ${dLong(d.signedAt)}.` + (ds.key === 'rolling' ? ' The initial term has ended, so it now rolls on until either side gives notice.' : ds.key === 'expiring' ? ` The initial term ends on ${dLong(ds.end)}.` : '')
  const cls = 'agstatus' + (ds.key === 'sent' ? ' wait' : ds.key === 'expiring' ? ' warn' : ds.key === 'signed' || ds.key === 'rolling' ? ' ok' : '')
  const det = detailsList(d.details)
  const pt = d.portal
  return (
    <>
      {back}
      <article className="doc">
        <AgreementHead kicker={`${spec ? 'Specialist works agreement' : 'Service agreement'} ${d.ref}`} title={d.client} />
        <p className={cls}>{status}</p>
        <AgreementViewBar id={d.id} signedCode={d.status === 'signed' ? d.code : null} portal={!!pt && !!d.clientId} />
        <h2 className="dh">Schedule of particulars</h2>
        <ul className="dul">{v.parts.map((p, i) => <li key={i}><strong>{p.k}:</strong> {p.v}</li>)}</ul>
        {det.length > 0 && <>
          <h2 className="dh">Client details (from signing)</h2>
          <ul className="dul">{det.map((p, i) => <li key={i}><strong>{p.k}:</strong> {p.v}</li>)}</ul>
        </>}
        {pt && <>
          <h2 className="dh">Client portal</h2>
          <p className="dp">Welcome email with their login sent to {pt.email} on {dLong(pt.sentAt)}{pt.resentAt ? `, sent again on ${dLong(pt.resentAt)}` : ''}. Their starter password is their first name ({pt.first}), and they choose their own the first time they log in.</p>
        </>}
        {!spec && d.status === 'signed' && !d.clientId && <p className="agstatus warn">Signed, but not set up as a client yet. Press Set up as client on the proposal in Documents, Proposals. Their client portal login is made then.</p>}
        <h2 className="dh">Schedule 1: {spec ? 'The works' : 'Scope of works'}</h2>
        {v.scope.length
          ? v.scope.map((g, i) => <div key={i}><div className="dlabel">{g.heading}</div><ul className="dul">{g.items.map((t, j) => <li key={j}>{t}</li>)}</ul></div>)
          : <p className="dp">As set out in the proposal the client accepted.</p>}
        <h2 className="dh">Terms</h2>
        {v.clauses.map(c => <div key={c.n}><div className="dlabel">{c.n}. {c.t}</div><p className="dp">{c.b}</p></div>)}
        <h2 className="dh">Signatures</h2>
        <div className="sigblock">
          {d.status === 'signed'
            ? <><div className="sigline">{d.signedBy}</div><div className="sigmeta">Signed electronically for {d.client} on {dLong(d.signedAt)}{d.signedIp ? ` (IP ${d.signedIp})` : ''}</div></>
            : <div className="sigmeta">Client signature: not signed yet</div>}
        </div>
        <div className="sigblock"><div className="sigline">Laith Humadi</div><div className="sigmeta">For Core Cleaning (ABN 45 344 135 153), Director</div></div>
      </article>
    </>
  )
}
