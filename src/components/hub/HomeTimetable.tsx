'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Prev, Next, Close } from './icons'
import { useLiveRefresh } from '@/lib/hub/use-live'
import { isoAdd, isoDow, mondayOf, monthStart, monthGrid, longDate, weekTitle, monthTitle } from '@/lib/hub/timetable'
import { homeEventsOn, schedText, addr, homeText, t12, type Home, type HomeEvent, type CalShow } from '@/lib/hub/homes'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DOW1 = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const SHOW: [CalShow, string][] = [['all', 'All'], ['recurring', 'Recurring'], ['oneoff', 'One-offs']]
const count = (n: number) => `${n} ${n === 1 ? 'clean' : 'cleans'}`

export function HomeTimetable({ homes, cleaners, today }: { homes: Home[]; cleaners: { id: string; name: string }[]; today: string }) {
  useLiveRefresh()
  const [view, setView] = useState<'week' | 'month'>('week')
  const [show, setShow] = useState<CalShow>('all')
  const [anchor, setAnchor] = useState(today)
  const [day, setDay] = useState(today)
  const [selKey, setSelKey] = useState<string | null>(null)

  const full = (id: string | null) => cleaners.find(c => c.id === id)?.name || 'Unassigned'
  const first = (id: string | null) => { const n = cleaners.find(c => c.id === id)?.name; return n ? n.split(/\s+/)[0] : 'Unassigned' }
  const on = (iso: string) => homeEventsOn(homes, iso, show, first)
  const week = Array.from({ length: 7 }, (_, i) => isoAdd(mondayOf(anchor), i))
  const month = monthGrid(anchor)
  const anchorMonth = anchor.slice(0, 7)
  const sel: HomeEvent | null = selKey ? on(selKey.split('|')[1]).find(e => e.key === selKey) || null : null

  function move(dir: 1 | -1) {
    setSelKey(null)
    if (view === 'week') { setAnchor(isoAdd(anchor, 7 * dir)); setDay(isoAdd(day, 7 * dir)) }
    else { const m = monthStart(anchor, dir); setAnchor(m); setDay(m) }
  }
  const time = (e: HomeEvent) => (e.start ? t12(e.start) + (e.finish ? '–' + t12(e.finish) : '') : 'No time')

  return (
    <>
      <div className="calbar">
        <div className="calnav">
          <button type="button" className="iconnav" onClick={() => move(-1)} aria-label={view === 'week' ? 'Previous week' : 'Previous month'}><Prev /></button>
          <button type="button" className="btn ghost caltoday" onClick={() => { setAnchor(today); setDay(today); setSelKey(null) }}>Today</button>
          <button type="button" className="iconnav" onClick={() => move(1)} aria-label={view === 'week' ? 'Next week' : 'Next month'}><Next /></button>
          <h2 className="caltitle" data-testid="cal-title">{view === 'week' ? weekTitle(anchor) : monthTitle(anchor)}</h2>
        </div>
        <div className="seg2" role="tablist" aria-label="Calendar view">
          <button type="button" role="tab" className={view === 'week' ? 'on' : ''} aria-selected={view === 'week'} onClick={() => { setView('week'); setSelKey(null) }}>Week</button>
          <button type="button" role="tab" className={view === 'month' ? 'on' : ''} aria-selected={view === 'month'} onClick={() => { setView('month'); setSelKey(null) }}>Month</button>
        </div>
      </div>
      <div className="chips rcalchips" role="group" aria-label="Show cleans">
        {SHOW.map(([v, label]) => (
          <button key={v} type="button" className={show === v ? 'chip on' : 'chip'} aria-pressed={show === v} onClick={() => { setShow(v); setSelKey(null) }}>{label}</button>
        ))}
      </div>

      {view === 'week' ? (
        <>
          <div className="calstrip" role="group" aria-label="Pick a day">
            {week.map(iso => {
              const n = on(iso).length
              return (
                <button key={iso} type="button" className={'sday' + (iso === day ? ' on' : '') + (iso === today ? ' today' : '')}
                  onClick={() => { setDay(iso); setSelKey(null) }} aria-pressed={iso === day} aria-label={`${longDate(iso)}, ${count(n)}`}>
                  <span className="sdow">{DOW1[isoDow(iso)]}</span><span className="sdate">{+iso.slice(8)}</span><span className={n ? 'sdot' : 'sdot none'} aria-hidden="true" />
                </button>
              )
            })}
          </div>
          <div className="calweek">
            {week.map(iso => {
              const evs = on(iso)
              return (
                <div key={iso} className={'cdcol' + (iso === today ? ' today' : '') + (iso === day ? ' chosen' : '')} data-testid="cal-day">
                  <button type="button" className="cdhead" onClick={() => { setDay(iso); setSelKey(null) }} aria-pressed={iso === day} aria-label={`${longDate(iso)}, ${count(evs.length)}`}>
                    <span className="cdow">{DOW[isoDow(iso)]}</span><span className="cdate">{+iso.slice(8)}</span><span className="ccount" title="Cleans">{evs.length}</span>
                  </button>
                  <div className="cevents">
                    {evs.map(e => (
                      <button key={e.key} type="button" data-testid="cal-ev"
                        className={`cev ${e.k}${e.unassigned ? ' unas' : ''}${e.done ? ' done' : ''}${selKey === e.key ? ' sel' : ''}`}
                        onClick={() => { setSelKey(e.key); setDay(iso) }}
                        aria-label={`${e.client}, ${e.suburb}, ${e.start ? t12(e.start) : 'no time'}, ${e.cleaner}${e.k === 'k6' ? ', one-off' : ''}`}>
                        <span className="cetime">{time(e)}</span>
                        <span className="cename">{e.client}</span>
                        <span className="cesub">{e.suburb ? e.suburb + ' · ' : ''}{e.cleaner}{e.k === 'k6' ? ' · one-off' : ''}</span>
                      </button>
                    ))}
                    {!evs.length && <div className="cnone">No cleans</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      ) : (
        <>
          <div className="calmonth">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d} className="mdow">{d}</div>)}
            {month.map(iso => {
              const evs = on(iso)
              return (
                <button key={iso} type="button" className={'mcell' + (iso.slice(0, 7) === anchorMonth ? '' : ' out') + (iso === today ? ' today' : '')}
                  onClick={() => { setView('week'); setAnchor(iso); setDay(iso); setSelKey(null) }} aria-label={`${longDate(iso)}, ${count(evs.length)}. Open this week`} data-testid="cal-cell">
                  <span className="mnum">{+iso.slice(8)}</span>
                  {evs.slice(0, 3).map(e => <span key={e.key} className={`mchip ${e.k}`}>{e.start ? t12(e.start) + ' ' : ''}{e.client}</span>)}
                  {evs.length > 3 && <span className="mmore">+{evs.length - 3} more</span>}
                  {evs.length > 0 && <span className="mcount">{evs.length}</span>}
                </button>
              )
            })}
          </div>
          <p className="legend"><span>Tap a day to open that week.</span></p>
        </>
      )}
      <p className="legend"><span className="rkey k1">Recurring</span><span className="rkey k6">One-off</span><span className="rkey unas">No cleaner yet</span></p>

      {sel && (
        <div className="calsel" role="region" aria-label="Clean details">
          <div className="sheethead"><strong>{sel.client}</strong>
            <button type="button" className="close" onClick={() => setSelKey(null)} aria-label="Close"><Close /></button>
          </div>
          <p className="sheetsub">{longDate(sel.iso)}{sel.start ? ', ' + t12(sel.start) + (sel.finish ? ' to ' + t12(sel.finish) : '') : ', time not set yet'}</p>
          <ul className="dul">
            <li>Address: {addr(sel.h)}</li>
            <li>Cleaner: {full(sel.h.cleaner_id)}</li>
            <li>{sel.h.kind === 'oneoff' ? 'One-off clean' + (sel.h.done ? ', done' : '') : schedText(sel.h)}</li>
            <li>Home: {homeText(sel.h)}</li>
            <li>Notes: {sel.h.notes || 'None'}</li>
          </ul>
          <div className="sheetbtns"><Link className="btn log" href={`/hub/residential/clients/${sel.id}?from=timetable`}>Open client</Link></div>
        </div>
      )}
    </>
  )
}
