import Link from 'next/link'
import { Back, House } from './icons'

const TABS = [
  { id: 'clients', label: 'Clients', href: '/hub/residential/clients' },
  { id: 'quotes', label: 'Quotes', href: '/hub/residential/quotes' },
  { id: 'timetable', label: 'Timetable', href: '/hub/residential/timetable' },
  { id: 'documents', label: 'Documents', href: '/hub/residential/documents' },
  { id: 'team', label: 'Team', href: '/hub/residential/team' },
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
