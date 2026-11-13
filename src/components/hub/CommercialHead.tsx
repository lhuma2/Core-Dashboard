import Link from 'next/link'
import { Back, Building } from './icons'
import { requestsNeedingYou } from '@/lib/hub/requests-data'

const TABS = [
  { id: 'clients', label: 'Clients', href: '/hub/commercial' },
  { id: 'timetable', label: 'Timetable', href: '/hub/commercial/timetable' },
  { id: 'requests', label: 'Requests', href: '/hub/commercial/requests' },
] as const

/** `requests`: how many client requests need Laith (shown on the tab). Pages that don't pass it look it up. */
export async function CommercialHead({ tab, requests }: { tab: (typeof TABS)[number]['id']; requests?: number }) {
  const n = requests ?? (await requestsNeedingYou())
  return (
    <>
      <Link className="back" href="/hub"><Back /> Dashboard</Link>
      <div className="phead">
        <span className="icon" style={{ background: '#e3f3ec', color: '#0f6e50' }}><Building /></span>
        <h1 className="greet">Commercial</h1>
      </div>
      <nav className="tabs" aria-label="Commercial sections">
        {TABS.map(t => (
          <Link key={t.id} className={t.id === tab ? 'tab on' : 'tab'} aria-current={t.id === tab ? 'page' : undefined} href={t.href}>{t.label}{t.id === 'requests' && n > 0 && <span className="tabn">{n}<span className="sr"> need you</span></span>}</Link>
        ))}
      </nav>
    </>
  )
}
