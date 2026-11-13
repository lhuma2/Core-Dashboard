import Link from 'next/link'
import { Back, House, Key } from './icons'
import { DIVN, divBase, type Div } from '@/lib/hub/div'

const TABS = [
  { id: 'clients', label: 'Clients' },
  { id: 'quotes', label: 'Quotes' },
  { id: 'timetable', label: 'Timetable' },
  { id: 'documents', label: 'Documents' },
  { id: 'team', label: 'Team' },
] as const

export function ResidentialHead({ div = 'res', tab, quotesToDo }: { div?: Div; tab: (typeof TABS)[number]['id']; quotesToDo?: number }) {
  const base = divBase(div), eol = div === 'eol'
  return (
    <>
      <Link className="back" href="/hub"><Back /> Dashboard</Link>
      <div className="phead">
        <span className="icon" style={eol ? { background: '#fdeedd', color: '#9a4d00' } : { background: '#e4eefb', color: '#1f5aa6' }}>{eol ? <Key /> : <House />}</span>
        <h1 className="greet">{DIVN[div]}</h1>
      </div>
      <nav className="tabs" aria-label={DIVN[div] + ' sections'}>
        {TABS.map(t => (
          <Link key={t.id} className={t.id === tab ? 'tab on' : 'tab'} aria-current={t.id === tab ? 'page' : undefined} href={base + '/' + t.id}>
            {t.label}{t.id === 'quotes' && quotesToDo ? <> <span className="n">{quotesToDo}</span></> : null}
          </Link>
        ))}
      </nav>
    </>
  )
}
