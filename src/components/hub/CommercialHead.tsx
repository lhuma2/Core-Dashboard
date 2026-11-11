import Link from 'next/link'
import { Back, Building } from './icons'

const TABS = [
  { id: 'clients', label: 'Clients', href: '/hub/commercial' },
  { id: 'timetable', label: 'Timetable', href: '/hub/commercial/timetable' },
] as const

export function CommercialHead({ tab }: { tab: (typeof TABS)[number]['id'] }) {
  return (
    <>
      <Link className="back" href="/hub"><Back /> Dashboard</Link>
      <div className="phead">
        <span className="icon" style={{ background: '#e3f3ec', color: '#0f6e50' }}><Building /></span>
        <h1 className="greet">Commercial</h1>
      </div>
      <nav className="tabs" aria-label="Commercial sections">
        {TABS.map(t => (
          <Link key={t.id} className={t.id === tab ? 'tab on' : 'tab'} aria-current={t.id === tab ? 'page' : undefined} href={t.href}>{t.label}</Link>
        ))}
      </nav>
    </>
  )
}
