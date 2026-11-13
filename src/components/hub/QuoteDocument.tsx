import type { QuoteDoc } from '@/lib/hub/home-quotes'

// The quote as the client sees it: cover, scope of works, terms, price, contact. Same sections and words as the mock-up.
export function QuoteDocument({ d }: { d: QuoteDoc }) {
  const Head = ({ n, label }: { n: string; label: string }) => (
    <div className="pdhead">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="plogoimg" src="/logo-black.png" alt="Core Cleaning" />
      <div className="pnum"><b>{n}</b> · {label}</div>
    </div>
  )
  return (
    <div className="pdoc">
      <section className="pcover qcover">
        <div className="pctop">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="plogoimg big" src="/hub-logo-white.png" alt="Core Cleaning" />
          <div className="pcref"><div className="pkick">Quote</div><div>Ref {d.ref}</div></div>
        </div>
        <div className="pcmid">
          <div className="pkick dim">Prepared for {d.name}</div>
          <h1 className="pch">{d.heading}</h1>
          {d.intro && <p className="pcsub">{d.intro}</p>}
        </div>
        <div className="pcfoot">
          <div><div className="pkick dim">Property</div><div>{d.address}</div><div>{d.homeLine}</div></div>
          <div><div className="pkick dim">Service</div><div>{d.typeLabel}</div><div>{d.freqLine}</div></div>
          <div className="r"><div className="pkick dim">Date</div><div>{d.date}</div><div>Valid to {d.validTo}</div></div>
        </div>
      </section>

      <section className="ppage">
        <Head n="01" label="Scope of works" />
        <h2 className="ph2">Scope of Works</h2>
        <p className="pp">{d.scopeSub}</p>
        <div className="pscopegrid">
          {d.scope.map(g => (
            <div className="pgroup" key={g.num}>
              <h3><span className="pin">{g.num}</span>{g.heading}</h3>
              <ul>{g.items.map((it, i) => <li key={i}>{it.text}{it.tag && <> <span className="ptag">{it.tag}</span></>}</li>)}</ul>
            </div>
          ))}
        </div>
        {d.isEol
          ? <div className="pcharges"><div className="pchargesh">✶ Subject to additional charges</div><p>{d.charges}</p></div>
          : <p className="pexcl">{d.excl}</p>}
      </section>

      <section className="ppage">
        <Head n="02" label="Terms" />
        <h2 className="ph2">Terms</h2>
        <div className="pterms">
          {d.terms.map((t, i) => <div key={i}><span className="pin">{i + 1}</span><p>{t}</p></div>)}
        </div>
        <p className="pexcl">Full terms are set out in Core Cleaning&apos;s Master Terms &amp; Conditions, which apply to this quote.</p>
      </section>

      <section className="ppage">
        <Head n="03" label="Price" />
        <h2 className="ph2">Your price</h2>
        <div className="pprice">
          <div><div className="pkick g">{d.priceKick}</div><div>{d.homeLine}</div>{d.hoursLine && <div>{d.hoursLine}</div>}</div>
          <div className="pamt"><div className="pamtrow"><b>{d.price}</b><span className="per">{d.per}</span></div><span className="gst">Incl. GST</span></div>
        </div>
        {d.addons.length > 0 && <p className="pp paddlead">{d.addonsLead}</p>}
        {d.addons.map(a => (
          <div className="paddon" key={a.name}>
            <div>
              <div className="pkick g">Add-on: {a.name}</div>
              {a.desc && <div>{a.desc}</div>}
              <ul className="paddul">{a.items.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </div>
            <div className="pamt"><b>{a.price}</b><span className="gst">Incl. GST</span></div>
          </div>
        ))}
        {d.addons.length > 0 && <div className="ptotal"><span>{d.totalLine}</span></div>}
      </section>

      <section className="ppage">
        <Head n="04" label="Contact" />
        <h2 className="ph2">Questions? Get in touch.</h2>
        <div className="pfootsig">
          <div><div className="pkick g">For Core Cleaning</div><div className="psig line">Laith Humadi</div><div className="psmall split"><span>Laith Humadi, Owner</span><span>{d.date}</span></div></div>
          <div className="r"><div>admin@corecleaning.services</div><div>0407 026 360</div><div>www.corecleaning.services</div><div>ABN 45 344 135 153</div></div>
        </div>
        <div className="pfoot"><span>Core Cleaning · Ref {d.ref}</span><span>ABN 45 344 135 153</span></div>
      </section>
    </div>
  )
}
