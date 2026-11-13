import Link from 'next/link'
import { Back, Building } from './icons'
import { requestsNeedingYou } from '@/lib/hub/requests-data'
import { surveysNeedingYou } from '@/lib/hub/surveys-data'
import { brisbaneToday } from '@/lib/hub/figures'

const TABS = [
  { id: 'clients', label: 'Clients', href: '/hub/commercial' },
  { id: 'timetable', label: 'Timetable', href: '/hub/commercial/timetable' },
  { id: 'requests', label: 'Requests', href: '/hub/commercial/requests' },
  { id: 'surveys', label: 'Surveys', href: '/hub/commercial/surveys' },
  { id: 'prospecting', label: 'Prospecting', href: '/hub/commercial/prospecting' },
  { id: 'team', label: 'Team', href: '/hub/commercial/team' },
] as const

/** `requests` / `surveys`: how many need Laith (shown on the tabs). Pages that don't pass them look them up. */
export async function CommercialHead({ tab, requests, surveys }: { tab: (typeof TABS)[number]['id']; requests?: number; surveys?: number }) {
  const [n, sv] = await Promise.all([requests ?? requestsNeedingYou(), surveys ?? surveysNeedingYou(brisbaneToday())])
  return (
    <>
      <Link className="back" href="/hub"><Back /> Dashboard</Link>
      <div className="phead">
        <span className="icon" style={{ background: '#e3f3ec', color: '#0f6e50' }}><Building /></span>
        <h1 className="greet">Commercial</h1>
      </div>
      <nav className="tabs" aria-label="Commercial sections">
        {TABS.map(t => (
          <Link key={t.id} className={t.id === tab ? 'tab on' : 'tab'} aria-current={t.id === tab ? 'page' : undefined} href={t.href}>{t.label}{t.id === 'requests' && n > 0 && <span className="tabn">{n}<span className="sr"> need you</span></span>}{t.id === 'surveys' && sv > 0 && <span className="tabn">{sv}<span className="sr"> need you</span></span>}</Link>
        ))}
      </nav>
    </>
  )
}
