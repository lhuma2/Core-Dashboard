'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { takeFlash } from '@/lib/hub/flash'
import { Search, Plus } from './icons'
import type { ClientRow } from '@/lib/hub/figures'

type View = 'active' | 'paused' | 'ended'
const VIEWS: [View, string][] = [['active', 'Active'], ['paused', 'Paused'], ['ended', 'Ended']]

export function ClientList({ rows, initial, initialQuery }: { rows: ClientRow[]; initial: View; initialQuery: string }) {
  const [view, setView] = useState<View>(initial)
  const [toast, setToast] = useState('')
  // The saved message from the New client form, shown once.
  useEffect(() => { const m = takeFlash(); if (m) setToast(m) }, [])
  const [query, setQuery] = useState(initialQuery)
  const q = query.trim().toLowerCase()
  const counts = { active: 0, paused: 0, ended: 0 }
  for (const r of rows) counts[r.view]++
  const shown = rows.filter(r => r.view === view && (!q || r.search.includes(q)))
  const emptyText = q
    ? `No ${view === 'active' ? '' : view + ' '}clients match "${query.trim()}".`
    : view === 'paused' ? 'No paused clients. Pause a client from their page.'
      : view === 'ended' ? 'No ended clients. Ended clients stay here with their history.'
        : 'No active clients yet.'

  return (
    <>
      <div className="toolbar">
        <label className="search">
          <Search />
          <span className="sr">Search clients</span>
          <input type="search" placeholder="Search clients" value={query} onChange={e => setQuery(e.target.value)} />
        </label>
        <Link className="primary" href="/hub/commercial/new"><Plus />New client</Link>
      </div>
      <div className="chips clchips" role="group" aria-label="Show clients">
        {VIEWS.map(([v, label]) => (
          <button key={v} type="button" className={view === v ? 'chip on' : 'chip'} aria-pressed={view === v} onClick={() => setView(v)}>
            {label} <span className="n">{counts[v]}</span>
          </button>
        ))}
      </div>
      <div className="list">
        <div className="lrow lhead" aria-hidden="true">
          <span>Client</span><span>Sites</span><span>Frequency</span><span>Cleaner</span><span className="r">Monthly</span><span className="r">Margin</span>
        </div>
        {shown.map(r => (
          <div key={r.id} className="lrow" data-testid="client-row">
            <span className="cmain">
              <span className="cbiz">{r.name}</span>
              <span className="csub">{r.suburb}</span>
              <span className="cmeta">{r.meta}</span>
            </span>
            <span className="col">{r.sites}</span>
            <span className="col">{r.freq}</span>
            <span className="col">{r.cleaner}</span>
            <span className="r cmoney">{r.mrr}</span>
            <span className="r"><span className={`h ${r.health}`}>{r.margin}</span></span>
          </div>
        ))}
        {!shown.length && <div className="empty">{emptyText}</div>}
      </div>
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button type="button" className="undo" onClick={() => setToast('')} aria-label="Dismiss">OK</button>
        </div>
      )}
      <p className="legend"><span className="h good">Healthy</span><span className="h watch">Watch</span><span className="h low">Low margin</span></p>
    </>
  )
}
