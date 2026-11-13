'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Back } from './icons'
import { setFlash, takeFlash } from '@/lib/hub/flash'
import { saveHome, type HomeForm } from '@/actions/hub-homes'
import { moneyLine } from '@/lib/hub/homes'
import { useDiv } from '@/lib/hub/use-div'

const DAYS: [string, string, string][] = [['mon', 'Mon', 'Monday'], ['tue', 'Tue', 'Tuesday'], ['wed', 'Wed', 'Wednesday'], ['thu', 'Thu', 'Thursday'], ['fri', 'Fri', 'Friday'], ['sat', 'Sat', 'Saturday'], ['sun', 'Sun', 'Sunday']]
const opts = (max: number) => Array.from({ length: max + 1 }, (_, i) => String(i))
const money = (v: string) => { const t = String(v || '').replace(/[$,\s]/g, ''); if (!/^\d+(\.\d{1,2})?$/.test(t)) return null; const n = parseFloat(t); return n > 0 ? n : null }

/** started: a recurring client whose first clean has passed (dates then set the pattern, or aren't asked for weekly). */
export function HomeFormView({ initial, started, wasKind, today, cleaners, signed, backHref, backLabel }: {
  initial: HomeForm; started: boolean; wasKind: '' | 'recurring' | 'oneoff'; today: string; cleaners: { id: string; name: string }[]; signed: boolean; backHref: string; backLabel: string
}) {
  const { base, div } = useDiv()
  const router = useRouter()
  const [f, setF] = useState<HomeForm>(initial)
  const [err, setErr] = useState('')
  const [busy, start] = useTransition()
  useEffect(() => { const m = takeFlash(); if (m) setErr(m) }, [])
  const isNew = !initial.id
  const up = (p: Partial<HomeForm>) => { setF({ ...f, ...p }); setErr('') }
  const isRec = f.kind === 'recurring'
  const dateMode = !isRec ? 'oneoff' : started && wasKind === 'recurring' ? (f.every === 'weekly' ? 'none' : 'pattern') : 'first'
  const ml = moneyLine(money(f.price) || 0, money(f.cost) || 0)
  const showKind = div !== 'eol' && (isNew || wasKind === 'oneoff')

  return (
    <>
      <Link className="back" href={backHref}><Back /> {backLabel}</Link>
      <h1 className="greet">{isNew ? (div === 'eol' ? 'New end of lease clean' : 'New residential client') : 'Edit ' + (initial.name || 'client')}</h1>
      <div role="form" className="addcard ncform">
        {showKind && <>
          <h2 className="nch">Type of clean</h2>
          <div className="stypes" role="radiogroup" aria-label="Type of clean">
            <button type="button" role="radio" className={isRec ? 'stype on' : 'stype'} aria-checked={isRec} onClick={() => up({ kind: 'recurring' })}>
              <span className="sticon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3" /><path d="M18 3v4h-4M6 21v-4h4" /></svg></span>
              <span className="sttext"><strong>Recurring</strong><span>Weekly, fortnightly or monthly</span></span>
            </button>
            <button type="button" role="radio" className={!isRec ? 'stype on' : 'stype'} aria-checked={!isRec} onClick={() => up({ kind: 'oneoff' })}>
              <span className="sticon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></svg></span>
              <span className="sttext"><strong>One-off</strong><span>A single clean on one date</span></span>
            </button>
          </div>
          {!isNew && wasKind === 'oneoff' && isRec && <p className="nchint">Turning this one-off into a regular client. The one-off stays in their history.</p>}
        </>}

        <h2 className="nch">Client</h2>
        <div className="ncgrid">
          <label className="fld span2"><span>Name <span className="req" aria-hidden="true">*</span><span className="sr">(required)</span></span><input type="text" autoComplete="off" placeholder="e.g. Sarah Mitchell" value={f.name} onChange={e => up({ name: e.target.value })} /></label>
          <label className="fld half"><span>Phone</span><input type="tel" autoComplete="off" placeholder="04XX XXX XXX" value={f.phone} onChange={e => up({ phone: e.target.value })} /></label>
          <label className="fld half"><span>Email</span><input type="email" autoComplete="off" autoCapitalize="off" placeholder="name@email.com" value={f.email} onChange={e => up({ email: e.target.value })} /></label>
          <label className="fld span2"><span>Street address <span className="req" aria-hidden="true">*</span><span className="sr">(required)</span></span><input type="text" autoComplete="off" placeholder="123 Example Street" value={f.street} onChange={e => up({ street: e.target.value })} /></label>
          <label className="fld subf"><span>Suburb <span className="req" aria-hidden="true">*</span><span className="sr">(required)</span></span><input type="text" autoComplete="off" placeholder="e.g. Ashgrove" value={f.suburb} onChange={e => up({ suburb: e.target.value })} /></label>
          <label className="fld pc"><span>Postcode <span className="req" aria-hidden="true">*</span><span className="sr">(required)</span></span><input type="text" inputMode="numeric" maxLength={4} autoComplete="off" placeholder="4060" value={f.postcode} onChange={e => up({ postcode: e.target.value.replace(/\D/g, '').slice(0, 4) })} /></label>
          <label className="fld half"><span>State</span>
            <select value={f.state} onChange={e => up({ state: e.target.value })}>{['QLD', 'NSW', 'ACT', 'VIC', 'TAS', 'SA', 'WA', 'NT'].map(s => <option key={s} value={s}>{s}</option>)}</select>
          </label>
        </div>

        <h2 className="nch">The home</h2>
        <div className="ncgrid">
          <label className="fld q"><span>Bedrooms</span><select value={f.beds} onChange={e => up({ beds: e.target.value })}>{opts(7).map(v => <option key={v}>{v}</option>)}</select></label>
          <label className="fld q"><span>Bathrooms</span><select value={f.baths} onChange={e => up({ baths: e.target.value })}>{opts(7).map(v => <option key={v}>{v}</option>)}</select></label>
          <label className="fld q"><span>Carpet steam (rooms)</span><select value={f.carpetRooms} onChange={e => up({ carpetRooms: e.target.value })}>{opts(10).map(v => <option key={v}>{v}</option>)}</select></label>
          <label className="fld q"><span>Carpet steam (hallways)</span><select value={f.hallways} onChange={e => up({ hallways: e.target.value })}>{opts(5).map(v => <option key={v}>{v}</option>)}</select></label>
          <label className="fld span2"><span>Access and notes for the cleaner</span><textarea rows={2} placeholder="e.g. Key in the lockbox, two cats, use the side gate" value={f.notes} onChange={e => up({ notes: e.target.value })} /></label>
        </div>

        <h2 className="nch">When</h2>
        {isRec && <>
          <div className="ncgrid">
            <label className="fld half"><span>How often</span>
              <select value={f.every} onChange={e => { const v = e.target.value as HomeForm['every']; up({ every: v, days: v === 'monthly' && f.days.length > 1 ? f.days.slice(0, 1) : f.days, first: started && wasKind === 'recurring' && v === 'weekly' ? '' : f.first }) }}>
                <option value="weekly">Every week</option><option value="fortnightly">Every fortnight</option><option value="monthly">Once a month</option>
              </select>
            </label>
          </div>
          <div className="fld"><span>Cleaning day</span>
            <div className="days" role="group" aria-label="Cleaning days">
              {DAYS.map(([k, s, full]) => {
                const on = f.days.includes(k)
                return <button key={k} type="button" className={on ? 'day on' : 'day'} aria-pressed={on} aria-label={full}
                  onClick={() => up({ days: on ? f.days.filter(x => x !== k) : f.every === 'monthly' ? [k] : [...f.days, k] })}>{s}</button>
              })}
            </div>
          </div>
          {f.every !== 'weekly' && <p className="fhint">{f.every === 'monthly' ? 'Once a month is one day. It repeats on the same week of the month as the date below (a 5th week falls back to the last week).' : 'Every second week, counted from the date below.'}</p>}
        </>}
        <div className="ncgrid">
          {dateMode !== 'none' && <label className="fld half"><span>{dateMode === 'oneoff' ? 'Clean date' : dateMode === 'pattern' ? 'Next clean date (sets the pattern)' : 'First clean date'}</span><input type="date" min={today} value={f.first} onChange={e => up({ first: e.target.value })} /></label>}
          <label className="fld q"><span>Start time</span><input type="time" value={f.start} onChange={e => up({ start: e.target.value })} /></label>
          <label className="fld q"><span>Finish time</span><input type="time" value={f.finish} onChange={e => up({ finish: e.target.value })} /></label>
          <label className="fld span2"><span>Cleaner</span>
            <select value={f.cleaner} onChange={e => up({ cleaner: e.target.value })}>
              <option value="">Unassigned for now</option>
              {cleaners.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>

        <h2 className="nch">Price</h2>
        <div className="ncgrid">
          <label className="fld half"><span>Client price per clean ($, incl GST) <span className="req" aria-hidden="true">*</span><span className="sr">(required)</span></span><input type="text" inputMode="decimal" autoComplete="off" placeholder="e.g. 165" value={f.price} onChange={e => up({ price: e.target.value })} /></label>
          <label className="fld half"><span>Cleaner cost per clean ($) <span className="req" aria-hidden="true">*</span><span className="sr">(required)</span></span><input type="text" inputMode="decimal" autoComplete="off" placeholder="e.g. 105" value={f.cost} onChange={e => up({ cost: e.target.value })} /></label>
        </div>
        {ml && <p className={ml.cls}>{ml.text}</p>}
        {!isNew && signed && <p className="cpnote">They have a signed agreement. If you change the price or how often, send them a new one from Documents so it matches.</p>}
        {isNew && <p className="cpnote">Adding a client sends them nothing. Send their agreement from their page when you’re ready.</p>}
        {err && <p className="ferr" role="alert">{err}</p>}
        <div className="cpbtns">
          <button type="button" className="btn call" disabled={busy} onClick={() => start(async () => {
            const r = await saveHome({ ...f, division: div })
            if (!r.ok) { setErr(r.error); return }
            setFlash(r.toast)
            router.push(`${base}/clients/${r.id}`)
            router.refresh()
          })}>{busy ? 'Saving…' : isNew ? 'Add client' : 'Save changes'}</button>
          <Link className="btn log" href={backHref}>Cancel</Link>
        </div>
      </div>
    </>
  )
}
