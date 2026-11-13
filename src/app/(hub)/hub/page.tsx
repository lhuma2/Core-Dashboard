import Link from 'next/link'
import { loadDashboard } from '@/lib/hub/dashboard-data'
import { greeting, money, noPriceNote, type Totals } from '@/lib/hub/figures'
import { Chev, Building, House, Key, People, Shield, Warning, Star, Chat } from '@/components/hub/icons'

export const dynamic = 'force-dynamic'

// Where each card opens. A card whose new screen isn't built yet stays as a plain card (no arrow) rather than
// opening an old-hub screen that reads different data. Fill these in as each screen is built.
const LINKS: Record<string, string | null> = {
  commercial: '/hub/commercial',
  residential: '/hub/residential/clients',
  eol: '/hub/end-of-lease/clients',
  team: '/hub/team',
  compliance: null,
  problems: '/hub/problems',
  requests: '/hub/commercial/requests',
  surveys: null,
}

/** A dashboard card: a link when its screen exists, otherwise a plain box. */
function Card({ href, className, label, children }: { href: string | null; className: string; label: string; children: React.ReactNode }) {
  if (href) return <Link className={className} href={href} aria-label={label + ' Open it.'}>{children}</Link>
  return <section className={className + ' static'} aria-label={label}>{children}</section>
}
function Arrow({ href }: { href: string | null }) { return href ? <Chev /> : null }

function DivisionCard({ name, lower, href, t, tint, ink, Icon }: {
  name: string; lower: string; href: string | null; t: Totals; tint: string; ink: string; Icon: () => JSX.Element
}) {
  const margin = t.margin === null ? '' : `${t.margin}%`
  return (
    <Card className="card" href={href}
      label={`${name}: monthly revenue ${money(t.revenue)}, net profit ${money(t.profit)}${margin ? ` (${margin})` : ''}, ${t.clients} active ${lower} clients.`}>
      <div className="chead">
        <span className="icon" style={{ background: tint, color: ink }}><Icon /></span>
        <span className="cname">{name}</span>
        <Arrow href={href} />
      </div>
      <div>
        <div className="lbl">Monthly revenue</div>
        <div className="rev" data-testid={`rev-${lower}`}>{money(t.revenue)}</div>
      </div>
      <div className="stats">
        <div className="stat">
          <div className="lbl">Net profit</div>
          <div className="sval" data-testid={`profit-${lower}`}>{money(t.profit)}<span className="margin">{margin}</span></div>
        </div>
        <div className="stat">
          <div className="lbl">Active clients</div>
          <div className="sval" data-testid={`clients-${lower}`}>{t.clients}</div>
        </div>
      </div>
    </Card>
  )
}

export default async function HubDashboard() {
  let d: Awaited<ReturnType<typeof loadDashboard>>
  try {
    d = await loadDashboard()
  } catch (e: any) {
    return (
      <>
        <h1 className="greet">Dashboard</h1>
        <p className="err" role="alert">The figures couldn’t load just now ({String(e?.message ?? e)}). Refresh the page to try again.</p>
      </>
    )
  }
  const note = noPriceNote(d.commercial.noPrice, d.residential.noPrice)
  const sv = d.surveys
  const svCls = 'card comp prob svdc' + (sv.toFollow ? ' has' : sv.due ? ' due' : '')

  return (
    <>
      <h1 className="greet">{greeting(d.hour)}, Laith</h1>
      <p className="sub">
        <span>Worked out from your clients, ex GST. {note}</span>
        <span className="pill">Residential clients moved across from the old hub. End of Lease starts fresh.</span>
      </p>
      <div className="cards">
        <DivisionCard name="Commercial" lower="commercial" href={LINKS.commercial} t={d.commercial} tint="#e3f3ec" ink="#0f6e50" Icon={Building} />
        <DivisionCard name="Residential" lower="residential" href={LINKS.residential} t={d.residential} tint="#e4eefb" ink="#1f5aa6" Icon={House} />
        <DivisionCard name="End of Lease" lower="end of lease" href={LINKS.eol} t={d.eol} tint="#fdeedd" ink="#9a4d00" Icon={Key} />
      </div>
      <div className="duo">
        <Card className="card team" href={LINKS.team} label={`Team: ${d.team.sub}.`}>
          <div className="chead">
            <span className="icon" style={{ background: '#eceaf8', color: '#4b3fa6' }}><People /></span>
            <span className="cname">Team</span>
            <span className="total">{d.team.sub}</span>
            <Arrow href={LINKS.team} />
          </div>
          <div className="regions">
            {d.team.regions.map(r => (
              <div className="stat" key={r.name}>
                <div className="lbl">{r.name}</div>
                <div className="sval">{r.count}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="card comp" href={LINKS.compliance} label={`Compliance pack: ${d.compliance} documents.`}>
          <div className="chead">
            <span className="icon" style={{ background: '#e3f3ec', color: '#0f6e50' }}><Shield /></span>
            <span className="cname">Compliance pack</span>
            <Arrow href={LINKS.compliance} />
          </div>
          <div className="stat compstat">
            <div className="lbl">Documents</div>
            <div className="sval">{d.compliance}</div>
          </div>
        </Card>
        <Card className={d.problemsOpen ? 'card comp prob has' : 'card comp prob'} href={LINKS.problems}
          label={`Problems reported: ${d.problemsOpen} open.`}>
          <div className="chead">
            <span className="icon" style={{ background: '#fdecea', color: '#b42318' }}><Warning /></span>
            <span className="cname">Problems reported</span>
            <Arrow href={LINKS.problems} />
          </div>
          <div className="stat compstat">
            <div className="lbl">Open</div>
            <div className="sval" data-testid="problems-open">{d.problemsOpen}</div>
          </div>
        </Card>
        <Card className={d.requestsNew ? 'card comp prob reqc has' : 'card comp prob reqc'} href={LINKS.requests}
          label={`Client requests: ${d.requestsNew} need you.`}>
          <div className="chead">
            <span className="icon" style={{ background: '#e4eefb', color: '#1f5aa6' }}><Chat /></span>
            <span className="cname">Client requests</span>
            <Arrow href={LINKS.requests} />
          </div>
          <div className="stat compstat">
            <div className="lbl">Need you</div>
            <div className="sval" data-testid="requests-new">{d.requestsNew}</div>
          </div>
        </Card>
        <Card className={svCls} href={LINKS.surveys}
          label={`Client surveys: ${sv.due} to send, ${sv.toFollow} to follow up, average score ${sv.avg}, ${sv.waiting} waiting.`}>
          <div className="chead">
            <span className="icon" style={{ background: '#fff3d6', color: '#7a4b00' }}><Star /></span>
            <span className="cname">Client surveys</span>
            <span className="total">Commercial, every 2 months</span>
            <Arrow href={LINKS.surveys} />
          </div>
          <div className="svdash">
            <div className="stat compstat"><div className="lbl">To send</div><div className="sval svdu">{sv.due}</div></div>
            <div className="stat compstat"><div className="lbl">To follow up</div><div className="sval svfu">{sv.toFollow}</div></div>
            <div className="stat compstat"><div className="lbl">Average score</div><div className="sval">{sv.avg}</div></div>
            <div className="stat compstat"><div className="lbl">Waiting</div><div className="sval">{sv.waiting}</div></div>
          </div>
        </Card>
      </div>
    </>
  )
}
