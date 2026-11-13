import type { PropDocView } from '@/lib/hub/proposals'

// The commercial / specialist proposal, page by page like Laith's template: cover, welcome, who we are, why Core, what we
// do, how we work, trust and safety, scope (page 08), terms, investment. Same words as the mock-up.
const LOGO_W = '/proposal-assets/wordmark-white.png'
const LOGO_B = '/proposal-assets/wordmark-black.png'

export function PHead({ n, label }: { n: string; label: string }) {
  return (
    <div className="pdhead">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="plogoimg" src={LOGO_B} alt="Core Cleaning" />
      <div className="pnum"><b>{n}</b> · {label}</div>
    </div>
  )
}
export function PCover({ kicker, ref_, biz, h, sub, cols }: { kicker: string; ref_: string; biz: string; h: string; sub: string; cols: [string, string, string][] }) {
  return (
    <section className="pcover">
      <div className="pctop">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="plogoimg big" src={LOGO_W} alt="Core Cleaning" />
        <div className="pcref"><div className="pkick">{kicker}</div><div>Ref {ref_}</div></div>
      </div>
      <div className="pcmid">
        <div className="pkick dim">Prepared for {biz}</div>
        <h1 className="pch">{h}</h1>
        <p className="pcsub">{sub}</p>
      </div>
      <div className="pcfoot">
        {cols.map(([k, a, b], i) => <div key={k} className={i === 2 ? 'r' : undefined}><div className="pkick dim">{k}</div><div>{a}</div><div>{b}</div></div>)}
      </div>
    </section>
  )
}

export function ProposalDoc({ d }: { d: PropDocView }) {
  return (
    <div className="pdoc">
      <PCover kicker={d.kicker} ref_={d.ref} biz={d.biz} h={d.coverH} sub={d.coverSub}
        cols={[['Prepared for', d.contact, d.biz], ['Prepared by', 'Laith Humadi', 'Core Cleaning'], ['Date', d.date, 'ABN 45 344 135 153']]} />

      <section className="ppage">
        <PHead n="02" label="Welcome" />
        <div className="pkick g">A note from us</div>
        <h2 className="ph2">Thank you for considering Core Cleaning.</h2>
        <p className="pp">Dear {d.contact},</p>
        <p className="pp">{d.w1}</p>
        <p className="pp">{d.w2}</p>
        <p className="pp">If anything needs adjusting to suit your premises or schedule, I am happy to tailor it.</p>
        <div className="psig">Laith Humadi</div>
        <div className="psmall">Owner, Core Cleaning · 0407 026 360</div>
        <div className="pkick g ptoc-h">Inside this proposal</div>
        <div className="ptoc">{d.toc.map(t => <div className="ptocrow" key={t.num}><span>{t.name}</span><span className="pgn">{t.num}</span></div>)}</div>
      </section>

      <section className="ppage">
        <PHead n="03" label="Who we are" />
        <div className="pkick g">Who we are</div>
        <h2 className="ph2">A trusted cleaning partner with five years of proven results.</h2>
        <p className="pp">Core Cleaning is a professional cleaning business serving commercial and residential clients across Brisbane, the Gold Coast and Ipswich. For more than five years we have built our reputation the simple way: turning up on time, cleaning thoroughly, and leaving every space better than we found it.</p>
        <p className="pp">Our commercial clients include offices, warehouses, medical and allied health clinics, retail premises and body corporate properties. Each one receives the same standard: meticulous, dependable and easy to deal with.</p>
        <div className="pstats">
          <div><b>5+</b><span>Years of experience</span></div>
          <div><b>5★</b><span>Rated by our clients</span></div>
          <div><b>$10M</b><span>Public liability cover</span></div>
          <div><b>50+</b><span>Police-checked cleaners</span></div>
        </div>
        <div className="pquote">“Cleaning done properly, every single time.”<span>Our motto</span></div>
      </section>

      <section className="ppage">
        <PHead n="04" label="Why Core" />
        <div className="pkick g">Why clients choose Core</div>
        <h2 className="ph2">The difference shows in the detail.</h2>
        <div className="pgrid2">
          {[['01', 'Experienced team', 'Five years across commercial, clinical and residential work, with 50+ registered, police-checked and vetted cleaners on file.'],
            ['02', 'Reliable & punctual', 'We show up when we say we will. No chasing, no missed visits, just dependable service you can plan your business around.'],
            ['03', 'Detail-driven', 'Corners, edges and finish set a clean apart. Every site has its own checklist, so nothing gets missed.'],
            ['04', 'Fully accountable', 'Transparent, GST-inclusive pricing and a team that stands behind its work. If something is not right, we fix it.'],
            ['05', 'Works around you', 'After hours, early mornings or weekends. We schedule around your trading hours so your team is never disrupted.'],
            ['06', 'One point of contact', 'You deal directly with the owner. Questions, changes and feedback are answered quickly by the person responsible for your site.']].map(([n, t, b]) => (
            <div className="pitem" key={n}><div className="pin">{n}</div><h3>{t}</h3><p>{b}</p></div>
          ))}
        </div>
      </section>

      <section className="ppage">
        <PHead n="05" label="What we do" />
        <div className="pkick g">What we do</div>
        <h2 className="ph2">Commercial cleaning for every kind of workplace.</h2>
        <p className="pp">Whatever the space, we bring the same care, consistency and attention to detail.</p>
        <div className="plist">
          {[['01', 'Offices & Workplaces', 'Desks, kitchenettes, bathrooms, floors and shared areas kept consistently presentable for staff and visitors.'],
            ['02', 'Clinical & Medical', 'Clinics, allied health and consulting rooms cleaned to a hygiene-first standard, with high-touch points sanitised every visit.'],
            ['03', 'Warehouses & Industrial', 'Warehouse floors, amenities, lunchrooms and attached offices, scheduled around operations.'],
            ['04', 'Body Corporate & Common Areas', 'Lobbies, stairwells, bin areas and leaf blowout of car parks, driveways and walkways.'],
            ['05', 'Floor Specialists & Windows', 'Carpet steam cleaning, vinyl floor strip and seal, plus internal windows and glass on a schedule that suits your site.']].map(([n, t, b]) => (
            <div className="prow" key={n}><span className="pin">{n}</span><strong>{t}</strong><span>{b}</span></div>
          ))}
        </div>
      </section>

      <section className="ppage">
        <PHead n="06" label="How we work" />
        <div className="pkick g">How we work</div>
        <h2 className="ph2">{d.howH}</h2>
        <div className="psteps">{d.how.map(h => <div key={h.n}><div className="pstepn">{h.n}</div><h3>{h.t}</h3><p>{h.b}</p></div>)}</div>
        {d.isComm && <div className="pbox"><div className="pkick g">Client portal</div><h3>See every clean, without having to ask.</h3><p>Your own client portal lets you stay on top of scheduled cleans, with photos of completed jobs available on request.</p></div>}
      </section>

      <section className="ppage">
        <PHead n="07" label="Trust & safety" />
        <div className="pkick g">Trust, safety &amp; insurance</div>
        <h2 className="ph2">Peace of mind, built in.</h2>
        <div className="pgrid2">
          {[['Fully insured', 'Core Cleaning holds $10,000,000 public liability insurance covering the work we carry out at your site. Certificate of Currency available on request.'],
            ['Vetted, accountable team', '50+ registered, police-checked and vetted cleaners on file, all working to the same standard on every site.'],
            ['Confidentiality', 'Client records and confidential paperwork are never handled or moved. We clean around them and treat everything we see on site as private.'],
            ['Safety first', 'Safe work practices on every visit, with hazards identified and managed so your staff and ours stay protected.'],
            ['The right products', 'Products are selected and used in line with manufacturer guidance, with alternatives available for sensitive surfaces or allergies.'],
            ['Respect for your property', 'A careful, professional team that treats your premises as its own, and reports anything that needs your attention.']].map(([t, b]) => (
            <div className="pitem" key={t}><h3>{t}</h3><p>{b}</p></div>
          ))}
        </div>
        <div className="pbadges">
          <span>$10,000,000 public liability insurance</span><span>Full compliance pack sent on quote approval</span>
          <span>Certificate of Currency on request</span><span>Registered business, ABN 45 344 135 153</span>
        </div>
      </section>

      <section className="ppage">
        <PHead n="08" label={d.scopeNav} />
        <div className="pkick g">{d.scopeKick}</div>
        <h2 className="ph2">Built for {d.biz}.</h2>
        <div className="psite">
          <div><div>{d.address}</div><div className="psmall">{d.biz}</div></div>
          <div className="r">{d.freqLines.map((t, i) => <div key={i}>{t}</div>)}</div>
        </div>
        {d.isComm
          ? <div className="pscopegrid">{d.groups.map(g => <div className="pgroup" key={g.num}><h3><span className="pin">{g.num}</span>{g.heading}</h3><ul>{g.items.map((t, i) => <li key={i}>{t}</li>)}</ul></div>)}</div>
          : <div className="pscopegrid one">{d.jobs.map(j => <div className="pgroup" key={j.num}><h3><span className="pin">{j.num}</span>{j.name}</h3><p className="psmall">{j.area}</p><ul>{j.items.map((t, i) => <li key={i}>{t}</li>)}</ul></div>)}</div>}
        <p className="pexcl">Excludes {d.excl}</p>
      </section>

      <section className="ppage">
        <PHead n="09" label="Terms" />
        <div className="pkick g">Terms at a glance</div>
        <h2 className="ph2">Clear, fair and upfront.</h2>
        <div className="pterms">{d.terms.map((b, i) => <div key={i}><span className="pin">{i + 1}</span><p>{b}</p></div>)}</div>
        <div className="pbox"><p>{d.termsNote}</p></div>
      </section>

      <section className="ppage">
        <PHead n="10" label="Investment" />
        <div className="pkick g">Your investment</div>
        <h2 className="ph2">Simple, transparent pricing.</h2>
        <div className="pprice">
          <div><div className="pkick g">{d.priceKick}</div>{d.priceLines.map((t, i) => <div key={i}>{t}</div>)}</div>
          <div className="pamt"><div className="pamtrow"><b>{d.price}</b><span className="per">{d.per}</span></div><span className="gst">Incl. GST</span></div>
        </div>
        {d.addons.map((a, i) => (
          <div className="paddon" key={i}>
            <div><div className="pkick g">{a.kick}</div><div>{a.desc}</div></div>
            <div className="pamt"><b>{a.price}</b><span className="gst">Incl. GST</span></div>
          </div>
        ))}
        <div className="pkick g ptoc-h">Next steps</div>
        <div className="pnext">{d.steps.map(s => <div key={s.n}><div className="pstepn">{s.n}</div><h3>{s.t}</h3><p>{s.b}</p></div>)}</div>
        <div className="pfootsig">
          <div><div className="pkick g">For Core Cleaning</div><div className="psig line">Laith Humadi</div><div className="psmall split"><span>Laith Humadi</span><span>{d.date}</span></div></div>
          <div className="r"><strong>Questions? Get in touch.</strong><div>admin@corecleaning.services</div><div>0407 026 360</div><div>www.corecleaning.services</div></div>
        </div>
        <div className="pfoot"><span>Core Cleaning · Ref {d.ref}</span><span>ABN 45 344 135 153</span></div>
      </section>
    </div>
  )
}
