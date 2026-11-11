'use client'

import { useState } from 'react'
import { Prev, Next, Close } from './icons'
import {
  eventsOn, isoAdd, isoDow, mondayOf, monthStart, monthGrid, longDate, weekTitle, monthTitle, t12,
  type TtService, type TtEvent,
} from '@/lib/hub/timetable'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DOW1 = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const count = (n: number) => `${n} ${n === 1 ? 'clean' : 'cleans'}`

export function Timetable({ services, today }: { services: TtService[]; today: string }) {
  const [view, setView] = useState<'week' | 'month'>('week')
  const [anchor, setAnchor] = useState(today)
  const [day, setDay] = useState(today)
  const [sel, setSel] = useState<TtEvent | null>(null)

  const week = Array.from({ length: 7 }, (_, i) => isoAdd(mondayOf(anchor), i))
  const month = monthGrid(anchor)
  const anchorMonth = anchor.slice(0, 7)

  function move(dir: 1 | -1) {
    setSel(null)
    if (view === 'week') { setAnchor(isoAdd(anchor, 7 * dir)); setDay(isoAdd(day, 7 * dir)) }
    else { const m = monthStart(anchor, dir); setAnchor(m); setDay(m) }
  }
  function openWeek(iso: string) { setView('week'); setAnchor(iso); setDay(iso); setSel(null) }

  return (
    <>
      <div className="calbar">
        <div className="calnav">
          <button type="button" className="iconnav" onClick={() => move(-1)} aria-label={view === 'week' ? 'Previous week' : 'Previous month'}><Prev /></button>
          <button type="button" className="btn ghost caltoday" onClick={() => { setAnchor(today); setDay(today); setSel(null) }}>Today</button>
          <button type="button" className="iconnav" onClick={() => move(1)} aria-label={view === 'week' ? 'Next week' : 'Next month'}><Next /></button>
          <h2 className="caltitle" data-testid="cal-title">{view === 'week' ? weekTitle(anchor) : monthTitle(anchor)}</h2>
        </div>
        <div className="seg2" role="tablist" aria-label="Calendar view">
          <button type="button" role="tab" className={view === 'week' ? 'on' : ''} aria-selected={view === 'week'} onClick={() => { setView('week'); setSel(null) }}>Week</button>
          <button type="button" role="tab" className={view === 'month' ? 'on' : ''} aria-selected={view === 'month'} onClick={() => { setView('month'); setSel(null) }}>Month</button>
        </div>
      </div>

      {view === 'week' ? (
        <>
          <div className="calstrip" role="group" aria-label="Pick a day">
            {week.map(iso => {
              const n = eventsOn(services, iso).length
              return (
                <button key={iso} type="button" className={'sday' + (iso === day ? ' on' : '') + (iso === today ? ' today' : '')}
                  onClick={() => { setDay(iso); setSel(null) }} aria-pressed={iso === day} aria-label={`${longDate(iso)}, ${count(n)}`}>
                  <span className="sdow">{DOW1[isoDow(iso)]}</span><span className="sdate">{+iso.slice(8)}</span><span className={n ? 'sdot' : 'sdot none'} aria-hidden="true" />
                </button>
              )
            })}
          </div>
          <div className="calweek">
            {week.map(iso => {
              const evs = eventsOn(services, iso)
              return (
                <div key={iso} className={'cdcol' + (iso === today ? ' today' : '') + (iso === day ? ' chosen' : '')} data-testid="cal-day">
                  <button type="button" className="cdhead" onClick={() => { setDay(iso); setSel(null) }} aria-pressed={iso === day} aria-label={`${longDate(iso)}, ${count(evs.length)}`}>
                    <span className="cdow">{DOW[isoDow(iso)]}</span><span className="cdate">{+iso.slice(8)}</span><span className="ccount" title="Cleans">{evs.length}</span>
                  </button>
                  <div className="cevents">
                    {evs.map(e => (
                      <button key={e.key} type="button" className={`cev ${e.k}${sel?.key === e.key ? ' sel' : ''}`} onClick={() => { setSel(e); setDay(iso) }}
                        aria-label={`${e.client}${e.site ? ', ' + e.site : ''}${e.start ? ', ' + t12(e.start) : ''}, ${e.cleaners}`}>
                        {e.start && <span className="cetime">{t12(e.start)}{e.finish ? '–' + t12(e.finish) : ''}</span>}
                        <span className="cename">{e.client}</span>
                        <span className="cesub">{e.site ? e.site + ' · ' : ''}{e.cleaners}</span>
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
              const evs = eventsOn(services, iso)
              return (
                <button key={iso} type="button" className={'mcell' + (iso.slice(0, 7) === anchorMonth ? '' : ' out') + (iso === today ? ' today' : '')}
                  onClick={() => openWeek(iso)} aria-label={`${longDate(iso)}, ${count(evs.length)}. Open this week`} data-testid="cal-cell">
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

      {sel && (
        <div className="calsel" role="region" aria-label="Clean details">
          <div className="sheethead"><strong>{sel.client}</strong>
            <button type="button" className="close" onClick={() => setSel(null)} aria-label="Close"><Close /></button>
          </div>
          <p className="sheetsub">{longDate(sel.iso)}{sel.start ? ', ' + t12(sel.start) + (sel.finish ? ' to ' + t12(sel.finish) : '') : ', time not set yet'}</p>
          <ul className="dul">
            <li>Site: {sel.site || 'Main site'}</li>
            <li>Cleaners: {sel.cleaners}</li>
          </ul>
        </div>
      )}
    </>
  )
}
