import Link from 'next/link'
import { Back, House } from './icons'

// Only the tabs that are built are shown, so there are no dead buttons. Clients, Timetable, Documents and Team
// join as each screen lands.
const TABS = [
  { id: 'quotes', label: 'Quotes', href: '/hub/residential/quotes' },
] as const

export function ResidentialHead({ tab, quotesToDo }: { tab: (typeof TABS)[number]['id']; quotesToDo?: number }) {
  return (
    <>
      <Link className="back" href="/hub"><Back /> Dashboard</Link>
      <div className="phead">
        <span className="icon" style={{ background: '#e4eefb', color: '#1f5aa6' }}><House /></span>
        <h1 className="greet">Residential</h1>
      </div>
      <nav className="tabs" aria-label="Residential sections">
        {TABS.map(t => (
          <Link key={t.id} className={t.id === tab ? 'tab on' : 'tab'} aria-current={t.id === tab ? 'page' : undefined} href={t.href}>
            {t.label}{t.id === 'quotes' && quotesToDo ? <> <span className="n">{quotesToDo}</span></> : null}
          </Link>
        ))}
      </nav>
    </>
  )
}
