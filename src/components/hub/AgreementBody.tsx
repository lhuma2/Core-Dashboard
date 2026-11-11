import type { AgrSnap } from '@/lib/hub/home-agreements'

// The agreement itself: particulars, Schedule 1 scope, the 19 clauses and both signatures. Mock-up wording.
export function AgreementBody({ ref_, snap, signedBy, signedOn }: { ref_: string; snap: AgrSnap; signedBy?: string | null; signedOn?: string }) {
  return (
    <>
      <h2 className="dh">Schedule of particulars</h2>
      <ul className="dul">
        <li><strong>Agreement:</strong> {ref_}</li>
        {snap.parts.map((p, i) => <li key={i}><strong>{p.k}:</strong> {p.v}</li>)}
      </ul>
      <h2 className="dh">Schedule 1: Scope of works</h2>
      {snap.scope.map((g, i) => (
        <div key={i}>
          {g.heading && <div className="dsub">{g.heading}</div>}
          <ul className="dul">{g.items.map((t, j) => <li key={j}>{t}</li>)}</ul>
        </div>
      ))}
      <p className="dp">Anything not listed is excluded (clause 3).</p>
      <h2 className="dh">Terms</h2>
      {snap.clauses.map(c => (
        <div key={c.n}>
          <div className="dlabel">{c.n}. {c.t}</div>
          <p className="dp">{c.b}</p>
        </div>
      ))}
      <h2 className="dh">Signatures</h2>
      <div className="sigblock">
        {signedBy
          ? <><div className="sigline">{signedBy}</div><div className="sigmeta">Signed electronically on {signedOn}</div></>
          : <div className="sigmeta">Client signature: not signed yet</div>}
      </div>
      <div className="sigblock"><div className="sigline">Laith Humadi</div><div className="sigmeta">For Core Cleaning (ABN 45 344 135 153), Director</div></div>
    </>
  )
}

export function AgreementHead({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="dochead">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="doclogo" src="/hub-logo-white.png" alt="Core Cleaning" />
      <div><div className="doccode">{kicker}</div><h1 className="doctitle">{title}</h1></div>
    </div>
  )
}
