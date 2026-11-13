'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search } from './icons'
import { useLiveRefresh } from '@/lib/hub/use-live'
import type { TeamHome, TeamRow } from '@/lib/hub/homes'
import { useDiv } from '@/lib/hub/use-div'

type F = 'all' | 'busy' | 'free'

function Homes({ list }: { list: TeamHome[] }) {
  const { base } = useDiv()
  return (
    <ul className="ctclients">
      {list.map(h => (
        <li key={h.id}><Link className="ctcname" href={`${base}/clients/${h.id}?from=team`}>{h.name}</Link><span className="ctline">{h.line}</span></li>
      ))}
    </ul>
  )
}

export function HomeTeam({ rows, unassigned }: { rows: TeamRow[]; unassigned: TeamHome[] }) {
  const { base, div, name: divName, lower: divLower } = useDiv()
  useLiveRefresh()
  const [query, setQuery] = useState('')
  const [f, setF] = useState<F>('all')
  const q = query.trim().toLowerCase()
  const chips: [F, string, number][] = [['all', 'All', rows.length], ['busy', 'With homes', rows.filter(r => r.homes.length).length], ['free', 'No homes', rows.filter(r => !r.homes.length).length]]
  const shown = rows.filter(r => (f === 'busy' ? r.homes.length > 0 : f === 'free' ? !r.homes.length : true) && (!q || r.search.includes(q)))

  return (
    <>
      <div className="toolbar">
        <label className="search">
          <Search />
          <span className="sr">Search the team</span>
          <input type="search" placeholder="Search by cleaner or client" value={query} onChange={e => setQuery(e.target.value)} />
        </label>
      </div>
      {unassigned.length > 0 && (
        <div className="ctcard unascard" data-testid="unas-card">
          <div className="cthead"><div className="ctwho"><div className="tname">{unassigned.length + (unassigned.length === 1 ? ' home has' : ' homes have')} no cleaner</div><div className="tcontact">Open one to pick a cleaner.</div></div></div>
          <Homes list={unassigned} />
        </div>
      )}
      <div className="chips" role="group" aria-label="Show cleaners">
        {chips.map(([v, label, n]) => (
          <button key={v} type="button" className={f === v ? 'chip on' : 'chip'} aria-pressed={f === v} onClick={() => setF(v)}>{label} <span className="n">{n}</span></button>
        ))}
      </div>
      <div className="ctlist">
        {shown.map(r => (
          <div key={r.id} className="ctcard" data-testid="team-card">
            <div className="cthead">
              <div className="ctwho"><div className="tname">{r.name}</div><div className="tcontact">{r.sub}</div></div>
              {r.phone && <a className="btn log" href={'tel:' + r.phone.replace(/[^\d+]/g, '')} aria-label={'Call ' + r.name}>Call</a>}
            </div>
            {r.homes.length ? <Homes list={r.homes} /> : <p className="ctnone">No homes right now.</p>}
          </div>
        ))}
        {!shown.length && <div className="empty">{rows.length ? 'No cleaners match.' : 'No cleaners on the team yet.'}</div>}
      </div>
    </>
  )
}
