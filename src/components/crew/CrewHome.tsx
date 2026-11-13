'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useLiveRefresh } from '@/lib/hub/use-live'
import { takeFlash } from '@/lib/hub/flash'
import { dateLabel, firstName, t12, type CrewJob } from '@/lib/crew/jobs'
import { isoAdd } from '@/lib/hub/timetable'
import { usePhotoTray } from './usePhotos'

const Chev = () => <svg className="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>

function JobRow({ j, today, me }: { j: CrewJob; today: string; me: string }) {
  const stx = j.status === 'done' ? 'Done' : j.status === 'in_progress' ? 'Started' : j.iso === today ? 'To do' : ''
  const others = j.team.filter(n => n !== me)
  const sub = (j.kind === 'res' ? 'Home · ' : j.kind === 'eol' ? 'End of lease · ' : '') + (j.suburb || '') +
    (others.length ? ' · with ' + others.map(firstName).join(', ') : '') + j.addons.map(a => ' · + ' + a.name).join('')
  return (
    <Link className="job" href={'/cleaner/app/job/' + j.key} aria-label={j.name + (j.start ? ', ' + t12(j.start) : '') + (stx ? ', ' + stx : '')} data-testid="job-row">
      <span className="jtime">{j.start ? t12(j.start) : 'Any time'}<span>{j.finish ? 'to ' + t12(j.finish) : ''}</span></span>
      <span className="jmain"><span className="jname">{j.name}</span><span className="jsub">{sub}</span></span>
      <span className={stx === 'Done' ? 'st done' : stx === 'Started' ? 'st going' : stx ? 'st todo' : 'sr'}>{stx}</span>
      <Chev />
    </Link>
  )
}

/** Home: greeting, the photo tray, Today / Next 7 days. */
export function CrewHome({ me, first, today, greeting, jobs }: { me: string; first: string; today: string; greeting: string; jobs: CrewJob[] }) {
  useLiveRefresh()
  const [view, setView] = useState<'today' | 'week'>('today')
  const [toast, setToast] = useState('')
  const tray = usePhotoTray(today)
  useEffect(() => {
    try { const v = sessionStorage.getItem('crew-view'); if (v === 'week') setView('week') } catch { /* private mode */ }
    const f = takeFlash(); if (f) setToast(f)
  }, [])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 4000); return () => clearTimeout(t) }, [toast])
  const pick = (v: 'today' | 'week') => { setView(v); try { sessionStorage.setItem('crew-view', v) } catch { /* private mode */ } }

  const todayJobs = jobs.filter(j => j.iso === today)
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const iso = isoAdd(today, i)
    return { iso, label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : dateLabel(iso), jobs: jobs.filter(j => j.iso === iso) }
  }), [jobs, today])

  return (
    <>
      <h1 className="greet">{greeting}, {first}</h1>
      <p className="sub">{dateLabel(today)}</p>
      {tray && (
        <div className={'tray' + (tray.off ? ' off' : '')} role="status" data-testid="photo-tray"><strong>{tray.title}</strong><span>{tray.sub}</span></div>
      )}
      <div className="seg" role="tablist" aria-label="Show jobs">
        <button type="button" role="tab" className={view === 'today' ? 'on' : ''} aria-selected={view === 'today'} onClick={() => pick('today')}>Today</button>
        <button type="button" role="tab" className={view === 'week' ? 'on' : ''} aria-selected={view === 'week'} onClick={() => pick('week')}>Next 7 days</button>
      </div>
      {view === 'today' ? (
        <div className="jobs">
          {todayJobs.map(j => <JobRow key={j.key} j={j} today={today} me={me} />)}
          {!todayJobs.length && <div className="empty">No cleans today. Check the next 7 days.</div>}
        </div>
      ) : (
        <div className="weekgrid">
          {week.map(d => (
            <div className="daycol" key={d.iso}>
              <h2 className="dayh">{d.label}</h2>
              <div className="jobs">
                {d.jobs.map(j => <JobRow key={j.key} j={j} today={today} me={me} />)}
                {!d.jobs.length && <div className="empty">No cleans</div>}
              </div>
            </div>
          ))}
        </div>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  )
}
