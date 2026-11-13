import type { ReactNode } from 'react'
import { PHead } from './ProposalDoc'
import type { Clause, Part } from '@/lib/hub/proposals'

// The commercial service agreement / specialist works agreement, page by page like the proposal: cover, your details,
// particulars, Schedule 1, terms, signatures. The signing page fills page 02 with the form and the last page with the
// sign box; the signed copy and the hub's viewer fill them with what the client entered.
const LOGO_W = '/proposal-assets/wordmark-white.png'

export interface AgView {
  kicker: string; ref: string; biz: string; address: string; coverH: string; coverSub: string; date: string
  parts: Part[]; fromProp?: boolean; scopeH: string; scope: { heading: string; items: string[] }[]; clauses: Clause[]
}

export function AgreementDoc({ v, details, signatures, detailsTitle = 'Your details' }: { v: AgView; details: ReactNode; signatures: ReactNode; detailsTitle?: string }) {
  return (
    <div className="pdoc">
      <section className="pcover">
        <div className="pctop">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="plogoimg big" src={LOGO_W} alt="Core Cleaning" />
          <div className="pcref"><div className="pkick">{v.kicker}</div><div>Ref {v.ref}</div></div>
        </div>
        <div className="pcmid">
          <div className="pkick dim">Prepared for {v.biz}</div>
          <h1 className="pch">{v.coverH}</h1>
          <p className="pcsub">{v.coverSub}</p>
        </div>
        <div className="pcfoot">
          <div><div className="pkick dim">Client</div><div>{v.biz}</div><div>{v.address}</div></div>
          <div><div className="pkick dim">Provider</div><div>Core Cleaning</div><div>Laith Humadi, Director</div></div>
          <div className="r"><div className="pkick dim">Date</div><div>{v.date}</div><div>ABN 45 344 135 153</div></div>
        </div>
      </section>

      <section className="ppage">
        <PHead n="02" label={detailsTitle} />
        {details}
      </section>

      <section className="ppage">
        <PHead n="03" label="Particulars" />
        <div className="pkick g">Schedule of particulars</div>
        <h2 className="ph2">The key details, in one place.</h2>
        <div className="aspart">{v.parts.map((p, i) => <div className="asprow" key={i}><span>{p.k}</span><strong>{p.v}</strong></div>)}</div>
      </section>

      <section className="ppage">
        <PHead n="04" label="Schedule 1" />
        <div className="pkick g">Schedule 1</div>
        <h2 className="ph2">{v.scopeH}</h2>
        {v.scope.length
          ? <div className="pscopegrid">{v.scope.map((g, i) => <div className="pgroup" key={i}><h3><span className="pin">{(i < 9 ? '0' : '') + (i + 1)}</span>{g.heading}</h3><ul>{g.items.map((t, j) => <li key={j}>{t}</li>)}</ul></div>)}</div>
          : <p className="pp">{v.fromProp ? 'As set out in the proposal you accepted.' : 'Your site checklist is agreed with you before your first clean, and you can see it in your client portal.'}</p>}
      </section>

      <section className="ppage">
        <PHead n="05" label="Terms" />
        <div className="pkick g">Terms and conditions</div>
        <h2 className="ph2">The full terms.</h2>
        <div className="asterms">{v.clauses.map(c => <div key={c.n}><h3><span className="pin">{c.n}</span>{c.t}</h3><p>{c.b}</p></div>)}</div>
      </section>

      <section className="ppage">
        <PHead n="06" label="Signatures" />
        {signatures}
        <div className="pfoot"><span>Core Cleaning · Ref {v.ref}</span><span>ABN 45 344 135 153</span></div>
      </section>
    </div>
  )
}

/** The signature blocks once signed (signed copy and the hub's viewer). */
export function SignedBlock({ biz, date, signedBy, role, signedOn, ip }: { biz: string; date: string; signedBy: string; role: string; signedOn: string; ip?: string }) {
  return (
    <>
      <div className="pkick g">Signatures</div>
      <h2 className="ph2">Signed.</h2>
      <div className="pfootsig">
        <div><div className="pkick g">For Core Cleaning</div><div className="psig line">Laith Humadi</div><div className="psmall split"><span>Laith Humadi, Director</span><span>{date}</span></div></div>
        <div><div className="pkick g">For {biz}</div><div className="psig line">{signedBy}</div><div className="psmall split"><span>{role}</span><span>{signedOn}</span></div></div>
      </div>
      <p className="psmall">Signed electronically by typing their full name and ticking to agree{ip ? `, from IP address ${ip}` : ''}, on {signedOn}.</p>
    </>
  )
}

/** Page 02 once signed: what the client filled in. */
export function DetailsBlock({ list }: { list: Part[] }) {
  return (
    <>
      <div className="pkick g">Client details</div>
      <h2 className="ph2">As entered when signing.</h2>
      <div className="aspart">{list.map((p, i) => <div className="asprow" key={i}><span>{p.k}</span><strong>{p.v}</strong></div>)}</div>
    </>
  )
}
