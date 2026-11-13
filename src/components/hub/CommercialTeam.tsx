'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search } from './icons'
import { REGION_NAME } from '@/lib/hub/team'
import type { CtRow } from '@/lib/hub/team-data'

type F = 'all' | 'with' | 'without'

/** Commercial → Team: each cleaner and the commercial clients they're on. Words from the mock-up. */
export function CommercialTeam({ rows }: { rows: CtRow[] }) {
  const [query, setQuery] = useState('')
  const [f, setF] = useState<F>('all')
  const q = query.trim().toLowerCase()
  const inF = (x: CtRow, v: F) => v === 'all' || (v === 'with' ? x.clients.length > 0 : !x.clients.length)
  const match = (x: CtRow) => !q || (x.name + ' ' + x.clients.map(k => k.name).join(' ')).toLowerCase().includes(q)
  const shown = rows.filter(x => inF(x, f) && match(x))
  return (
    <>
      <div className="toolbar">
        <label className="search">
          <Search />
          <span className="sr">Search the team</span>
          <input type="search" placeholder="Search by cleaner or client" value={query} onChange={e => setQuery(e.target.value)} />
        </label>
        <Link className="btn log" href="/hub/team">Add or manage cleaners</Link>
      </div>
      <div className="chips" role="group" aria-label="Show cleaners">
        {([['all', 'All'], ['with', 'With clients'], ['without', 'No clients yet']] as [F, string][]).map(([v, label]) => (
          <button key={v} type="button" className={f === v ? 'chip on' : 'chip'} aria-pressed={f === v} onClick={() => setF(v)}>{label} <span className="n">{rows.filter(x => inF(x, v)).length}</span></button>
        ))}
      </div>
      <div className="ctlist">
        {shown.map(x => {
          const tel = x.phone.replace(/[^0-9+]/g, '')
          const sub = [REGION_NAME[x.region || ''] || 'Region not set', x.clients.length ? `${x.clients.length} ${x.clients.length === 1 ? 'client' : 'clients'} · about ${x.visits} ${x.visits === 1 ? 'clean' : 'cleans'} a month` : ''].filter(Boolean).join(' · ')
          return (
            <div className="ctcard" key={x.id} data-testid="ct-card">
              <div className="cthead">
                <div className="ctwho">
                  <div className="tname">{x.name}{x.leader && <span className="tag wt">Team leader</span>}{!x.signed && <span className="tag draft">Pack not signed</span>}</div>
                  <div className="tcontact">{sub}</div>
                </div>
                {tel && <a className="btn log" href={'tel:' + tel} aria-label={'Call ' + x.name}>Call</a>}
              </div>
              {x.clients.length > 0
                ? <ul className="ctclients">{x.clients.map(k => (
                    <li key={k.id}><Link className="ctcname" href={`/hub/commercial/clients/${k.id}?from=team`}>{k.name}</Link>{k.lines.map((l, i) => <span className="ctline" key={i}>{l}</span>)}</li>
                  ))}</ul>
                : <p className="ctnone">{!x.signed ? 'Can be assigned to clients once they’ve signed their onboarding pack.' : 'No commercial clients yet. Assign them from a client’s service details.'}</p>}
            </div>
          )
        })}
        {!shown.length && <div className="empty">{q ? `No cleaners or clients match "${query}".` : 'No cleaners here.'}</div>}
      </div>
    </>
  )
}
