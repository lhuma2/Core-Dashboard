'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Search, Plus } from './icons'
import { takeFlash } from '@/lib/hub/flash'
import { useLiveRefresh } from '@/lib/hub/use-live'
import type { HomeRow, View } from '@/lib/hub/homes'

const VIEWS: [View, string][] = [['recurring', 'Recurring'], ['oneoff', 'One-offs'], ['past', 'Finished']]

export function HomeList({ rows, initial }: { rows: HomeRow[]; initial: View }) {
  useLiveRefresh()
  const [view, setView] = useState<View>(initial)
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState('')
  useEffect(() => { const m = takeFlash(); if (m) setToast(m) }, [])
  const q = query.trim().toLowerCase()
  const shown = rows.filter(r => r.views.includes(view) && (!q || r.search.includes(q))).sort((a, b) => (a.sort[view] < b.sort[view] ? -1 : a.sort[view] > b.sort[view] ? 1 : 0))
  const empty = q ? `No clients match “${query.trim()}”.`
    : view === 'recurring' ? 'No recurring clients yet. Tap New client to add one.'
      : view === 'oneoff' ? 'No one-off cleans booked.'
        : 'Nothing finished yet. Ended recurring clients and done or cancelled one-offs show here.'

  return (
    <>
      <div className="toolbar">
        <label className="search">
          <Search />
          <span className="sr">Search residential clients</span>
          <input type="search" placeholder="Search by name, suburb or cleaner" value={query} onChange={e => setQuery(e.target.value)} />
        </label>
        <Link className="primary" href="/hub/residential/clients/new"><Plus />New client</Link>
      </div>
      <div className="chips clchips" role="group" aria-label="Show clients">
        {VIEWS.map(([v, label]) => (
          <button key={v} type="button" className={view === v ? 'chip on' : 'chip'} aria-pressed={view === v} onClick={() => setView(v)}>
            {label} <span className="n">{rows.filter(r => r.views.includes(v)).length}</span>
          </button>
        ))}
      </div>
      <div className="list">
        <div className="lrow lhead rlrow" aria-hidden="true">
          <span>Client</span><span>{view === 'oneoff' ? 'Date' : 'How often'}</span><span>Status</span><span>Cleaner</span><span className="r">Per clean</span><span className="r">Margin</span>
        </div>
        {shown.map(r => (
          <Link key={r.id} href={`/hub/residential/clients/${r.id}`} className="lrow rlrow" aria-label={`Open ${r.name}, ${r.sched}`} data-testid="home-row">
            <span className="cmain">
              <span className="cbiz">{r.name}</span>
              <span className="csub">{r.suburb}</span>
              <span className="cmeta">{r.meta}</span>
              {r.status && <span className="cmeta rstat">{r.status}</span>}
            </span>
            <span className="col">{r.sched}</span>
            <span className="col"><span className={r.tagCls}>{r.tag}</span> {r.status && <span className="rsmall">{r.status}</span>}</span>
            <span className="col">{r.cleaner}</span>
            <span className="r cmoney">{r.price}</span>
            <span className="r"><span className={r.marginCls}>{r.margin}</span></span>
          </Link>
        ))}
        {!shown.length && <div className="empty">{empty}</div>}
      </div>
      <p className="legend"><span>Prices include GST. Margin is worked out on the price ex GST.</span></p>
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button type="button" className="undo" onClick={() => setToast('')} aria-label="Dismiss">OK</button>
        </div>
      )}
    </>
  )
}
