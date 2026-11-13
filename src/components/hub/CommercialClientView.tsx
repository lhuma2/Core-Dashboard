'use client'

import { Fragment, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Back, Plus } from './icons'
import {
  saveClientDetails, saveService, toggleServiceCleaner, cleanersToast, saveServiceAccess, setAddonDue, removeAddon, addAddon,
  pauseClient, endClient, resumeClient, reactivateClient,
} from '@/actions/hub-client-page'
import { DAYS, STATES, EVERY_OPTS, EXTRA_KINDS, EXTRA_FREQS, svcMoney, extraMoney, fmt$, time12, type NcSvc, type NcExtra } from '@/lib/hub/new-client'
import { currentStatus, cleansPerMonth, freqText } from '@/lib/hub/figures'
import { dLong, dShort } from '@/lib/hub/home-quotes'
import {
  ADDON_FREQ_LABEL, PAUSE_REASONS, END_REASONS, addonTasks, presetFor, nextVisit,
  type CpClient, type CpCleaner, type CpHistory, type CpProblem, type CpService,
} from '@/lib/hub/client-page'

import { type HubRequest, rqState, rqTitle } from '@/lib/hub/requests'

type R = { ok: true; toast: string } | { ok: false; error: string }
export interface CpStats { mrr: string; margin: string; health: 'good' | 'watch' | 'low' }

const REGION_NAME: Record<string, string> = { north: 'North Brisbane', south: 'South Brisbane', ipswich: 'Ipswich', gold_coast: 'Gold Coast', brisbane: 'Brisbane' }
const DAYW: Record<string, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' }
const initials = (n: string) => { const p = n.trim().split(/\s+/); return ((p[0] ?? '').charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : '')).toUpperCase() }
const regionLine = (t: CpCleaner) => (REGION_NAME[t.region ?? ''] ?? 'No region') + (t.leader ? ' · Team leader' : '')
const Person = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="10" cy="8" r="4" /><path d="M3 20c0-3.5 3-6 7-6s7 2.5 7 6M19 8v6M16 11h6" /></svg>
const Tick = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
const X = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>

export function CommercialClientView({ c, cleaners, problems, history, stats, today, from, photos, requests = [] }: {
  c: CpClient; cleaners: CpCleaner[]; problems: CpProblem[]; history: CpHistory[]; stats: CpStats; today: string; from?: string; photos?: React.ReactNode; requests?: HubRequest[]
}) {
  const router = useRouter()
  const [edit, setEdit] = useState<string | null>(null)
  const [d, setD] = useState<Record<string, any>>({})
  const [err, setErr] = useState('')
  const [pick, setPick] = useState<number | null>(null)
  const [picked, setPicked] = useState<Record<string, string[]>>({})
  const [delX, setDelX] = useState<string | null>(null)
  const [sowOpen, setSowOpen] = useState<Record<number, boolean>>({})
  const [toast, setToast] = useState('')
  const [busy, start] = useTransition()

  const [backHref, backLabel] = from === 'timetable' ? ['/hub/commercial/timetable', 'Timetable'] : from === 'problems' ? ['/hub/problems', 'Problems'] : from === 'requests' ? ['/hub/commercial/requests', 'Requests'] : from === 'team' ? ['/hub/commercial/team', 'Team'] : from === 'surveys' ? ['/hub/commercial/surveys', 'Surveys'] : ['/hub/commercial', 'Clients']
  const st = currentStatus(c, today)
  const open = (key: string, draft: Record<string, any>) => { setEdit(key); setD(draft); setErr(''); setPick(null); setDelX(null) }
  const close = () => { setEdit(null); setD({}); setErr('') }
  const set = (k: string) => (e: { target: { value: string } }) => { const v = e.target.value; setD(x => ({ ...x, [k]: v })); setErr('') }
  const run = (p: () => Promise<R>, after?: () => void) => start(async () => {
    let r: R
    try { r = await p() } catch { r = { ok: false, error: 'Couldn’t reach the hub. Check your connection and try again.' } }
    if (!r.ok) { if (edit) setErr(r.error); else setToast(r.error); return }
    close(); setDelX(null)
    if (r.toast) setToast(r.toast)
    after?.()
    router.refresh()
  })
  const errP = err ? <p className="ferr" role="alert">{err}</p> : null
  const btns = (label: string, onSave: () => void, cls = 'btn call') => (
    <div className="cpbtns"><button type="button" className={cls} disabled={busy} onClick={onSave}>{label}</button><button type="button" className="btn log" onClick={close}>Cancel</button></div>
  )

  const addr = [c.street, [c.suburb, c.street ? c.state || 'QLD' : '', c.postcode].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  const visits = Math.round(c.services.reduce((t, s) => t + cleansPerMonth(s), 0))
  const statusText = st === 'paused'
    ? (c.paused_from && c.paused_from > today ? 'Pausing from ' : 'Paused from ') + dLong(c.paused_from) + (c.resume_on ? '. Cleans restart ' + dLong(c.resume_on) + ' by themselves.' : '. No restart date yet.') + (c.reason ? ' Reason: ' + c.reason + '.' : '')
    : st === 'ended' ? 'Ended. ' + ((c.ended_on || '') >= today ? 'Last clean will be ' : 'Last clean was ') + dLong(c.ended_on) + '.' + (c.reason ? ' Reason: ' + c.reason + '.' : '') : ''
  const resumeBtn = (cls: string) => <button type="button" className={cls} disabled={busy} onClick={() => run(() => resumeClient(c.id))}>Resume now</button>
  const reactBtn = (cls: string) => <button type="button" className={cls} disabled={busy} onClick={() => run(() => reactivateClient(c.id))}>Reactivate</button>

  function serviceCard(sv: CpService, i: number) {
    const title = c.multi ? sv.siteName || `Site ${i + 1}` : 'Service details'
    const siteAddr = c.multi ? [sv.siteStreet, [sv.siteSuburb, sv.sitePostcode].filter(Boolean).join(' ')].filter(Boolean).join(', ') : ''
    const editKey = 'svc:' + i, accKey = 'acc:' + i, addKey = 'add:' + i
    const editing = edit === editKey, accEditing = edit === accKey, adding = edit === addKey, picking = pick === i
    const firstFuture = !sv.first || sv.first >= today
    const viewMoney = svcMoney({ days: Object.fromEntries(sv.days.map(k => [k, true])), every: sv.every, cost: String(sv.cost || ''), price: String(sv.price || '') } as NcSvc)
    const editMoney = editing ? svcMoney({ days: d.days || {}, every: d.every, cost: d.cost, price: d.price } as NcSvc) : null
    const items: string[] = adding ? d.items || [] : []
    const addMoney = adding ? extraMoney({ kind: d.kind, custom: d.custom, freq: d.freq, price: d.price, cost: d.cost } as NcExtra) : null
    const ids = picked[sv.id] ?? sv.cleaners
    const mine = ids.map(id => cleaners.find(t => t.id === id)).filter((t): t is CpCleaner => !!t)
    const sowN = sv.sow.reduce((t, h) => t + h.items.length, 0)
    const setItems = (fn: (l: string[]) => string[]) => { setD(x => ({ ...x, items: fn([...(x.items || [])]) })); setErr('') }

    return (
      <section className="addcard cpcard" key={sv.id} aria-label={title}>
        <div className="cpcardh">
          <div><h2 className="nch">{title}</h2>{siteAddr && <p className="cpaddr">{siteAddr}</p>}</div>
          {!editing && <button type="button" className="btn log" onClick={() => {
            const ev = sv.every || 'weekly'
            open(editKey, {
              days: Object.fromEntries(sv.days.map(k => [k, true])), every: ev, pat: ev !== 'weekly' ? nextVisit(sv, today) : '', start: sv.start, finish: sv.finish, first: sv.first || '',
              price: sv.price ? String(sv.price) : '', cost: sv.cost ? String(sv.cost) : '', sname: sv.siteName, sstreet: sv.siteStreet, ssuburb: sv.siteSuburb, spostcode: sv.sitePostcode,
            })
          }} aria-label={'Edit ' + title}>Edit</button>}
        </div>

        {!editing ? <>
          <dl className="cpkv">
            <div><dt>Days</dt><dd>{(sv.days.length ? sv.days.map(k => DAYW[k]).join(', ') : 'No days set') + ' · ' + freqText(sv.days.length, sv.every)}</dd></div>
            <div><dt>Time</dt><dd>{sv.start ? time12(sv.start) + (sv.finish ? ' to ' + time12(sv.finish) : '') : 'No start time'}</dd></div>
            <div><dt>First clean</dt><dd>{sv.first ? (sv.first > today ? 'Starts ' : 'Since ') + dLong(sv.first) : 'No first clean date on file'}</dd></div>
            <div><dt>Client price</dt><dd>{sv.price > 0 ? fmt$(sv.price) + ' a visit, ex GST' : 'Not on file'}</dd></div>
            <div><dt>Cleaner cost</dt><dd>{sv.cost > 0 ? fmt$(sv.cost) + ' a visit' : 'Not on file'}</dd></div>
          </dl>
          {viewMoney && <p className={viewMoney.cls}>{viewMoney.text}</p>}
        </> : (
          <div role="form" className="ncform">
            {c.multi && (
              <div className="ncgrid">
                <label className="fld span2"><span>Site name</span><input type="text" autoComplete="off" maxLength={200} value={d.sname} onChange={set('sname')} /></label>
                <label className="fld span2"><span>Street address</span><input type="text" autoComplete="off" maxLength={300} value={d.sstreet} onChange={set('sstreet')} /></label>
                <label className="fld subf"><span>Suburb</span><input type="text" autoComplete="off" maxLength={100} value={d.ssuburb} onChange={set('ssuburb')} /></label>
                <label className="fld pc"><span>Postcode</span><input type="text" inputMode="numeric" maxLength={4} autoComplete="off" value={d.spostcode} onChange={set('spostcode')} /></label>
              </div>
            )}
            <div className="fld"><span>Cleaning days</span>
              <div className="days" role="group" aria-label="Cleaning days">
                {DAYS.map(([k, short, full]) => {
                  const on = !!(d.days || {})[k]
                  return <button key={k} type="button" className={on ? 'day on' : 'day'} aria-pressed={on} aria-label={full} onClick={() => { setD(x => ({ ...x, days: { ...(x.days || {}), [k]: !(x.days || {})[k] } })); setErr('') }}>{short}</button>
                })}
              </div>
            </div>
            <div className="ncgrid">
              <label className="fld half"><span>How often</span><select value={d.every} onChange={e => { const v = e.target.value; setD(x => ({ ...x, every: v, pat: v !== 'weekly' && !x.pat ? nextVisit({ days: Object.keys(x.days || {}).filter(k => x.days[k]), every: 'weekly', anchor: null, first: sv.first }, today) : x.pat })); setErr('') }}>{EVERY_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
              {d.every !== 'weekly' && !firstFuture && <label className="fld half"><span>{d.every === 'monthly' ? 'Next clean date (sets the week of the month)' : 'Next clean date (sets which weeks)'}</span><input type="date" min={today} value={d.pat} onChange={set('pat')} /></label>}
              <label className="fld half"><span>Start time</span><input type="time" value={d.start} onChange={set('start')} /></label>
              <label className="fld half"><span>Finish time (optional)</span><input type="time" value={d.finish} onChange={set('finish')} /></label>
              {firstFuture && <label className="fld half"><span>First clean date</span><input type="date" min={today} value={d.first} onChange={set('first')} /></label>}
              <label className="fld half"><span>Total cleaner cost per visit ($)</span><input type="text" inputMode="decimal" autoComplete="off" value={d.cost} onChange={set('cost')} /></label>
              <label className="fld half"><span>Client price per visit ($, ex GST)</span><input type="text" inputMode="decimal" autoComplete="off" value={d.price} onChange={set('price')} /></label>
            </div>
            {editMoney && <p className={editMoney.cls}>{editMoney.text}</p>}
            <p className="cpnote">A new price applies from the next clean. If it changes what the client pays, send them a variation so the agreement matches.</p>
            {errP}
            {btns('Save changes', () => run(() => saveService(sv.id, { days: Object.keys(d.days || {}).filter(k => d.days[k]), every: d.every, pat: d.pat, start: d.start, finish: d.finish, first: d.first, price: d.price, cost: d.cost, sname: d.sname, sstreet: d.sstreet, ssuburb: d.ssuburb, spostcode: d.spostcode })))}
          </div>
        )}

        <div className="cpsec">
          <h3 className="cpsh">Cleaners</h3>
          {mine.map(t => <div key={t.id} className="assigned"><span className="avatar sm" aria-hidden="true">{initials(t.name)}</span><span className="asname"><strong>{t.name}</strong><span>{regionLine(t)}</span></span></div>)}
          {!mine.length && <p className="cpnone">No cleaner assigned yet.</p>}
          {!picking ? (
            <button type="button" className="btn log assignbtn" aria-expanded="false" onClick={() => { setPick(i); close(); setDelX(null) }}><Person />{mine.length ? 'Reassign cleaners' : 'Assign cleaners'}</button>
          ) : (
            <div className="picker" role="listbox" aria-multiselectable="true" aria-label="Choose cleaners">
              <p className="pickhint">Tap to add someone, tap again to take them off. Changes save straight away.</p>
              {cleaners.map(t => {
                const sel = ids.includes(t.id)
                return (
                  <button key={t.id} type="button" role="option" className={'pick' + (sel ? ' on' : '') + (t.signed ? '' : ' off')} aria-selected={sel} aria-disabled={!t.signed} disabled={busy}
                    onClick={() => {
                      if (!t.signed && !sel) { setToast(`${t.name.split(' ')[0]} can’t be assigned until they sign the compliance pack.`); return }
                      start(async () => {
                        let r: Awaited<ReturnType<typeof toggleServiceCleaner>>
                        try { r = await toggleServiceCleaner(sv.id, t.id) } catch { r = { ok: false, error: 'Couldn’t reach the hub. Check your connection and try again.' } }
                        if (!r.ok) { setToast(r.error); return }
                        setPicked(p => ({ ...p, [sv.id]: r.ok && 'cleaners' in r && r.cleaners ? r.cleaners : ids }))
                      })
                    }}>
                    <span className="avatar sm" aria-hidden="true">{initials(t.name)}</span>
                    <span className="asname"><strong>{t.name}</strong><span>{regionLine(t) + (t.signed ? '' : ' · Pack not signed yet')}</span></span>
                    <span className={sel ? 'tick on' : 'tick'} aria-hidden="true"><Tick /></span>
                  </button>
                )
              })}
              {!cleaners.length && <p className="cpnone">No cleaners in the team yet.</p>}
              <button type="button" className="btn call pickdone" disabled={busy} onClick={() => start(async () => {
                setPick(null)
                try { const r = await cleanersToast(sv.id); setToast(r.ok ? r.toast : r.error) } catch { /* the list on screen is already right */ }
                router.refresh()
              })}>{mine.length ? `Done (${mine.length} selected)` : 'Done'}</button>
            </div>
          )}
        </div>

        <div className="cpsec">
          <div className="cpcardh"><h3 className="cpsh">Access details</h3>
            {!accEditing && <button type="button" className="linkbtn" onClick={() => open(accKey, { access: sv.access })}>{sv.access ? 'Edit' : 'Add access details'}</button>}
          </div>
          {!accEditing ? (sv.access ? <p className="cptext">{sv.access}</p> : <p className="cpnone">None on file.</p>) : <>
            <label className="fld"><span className="sr">Access details</span><textarea rows={3} maxLength={2000} placeholder="Keys or swipe card, alarm instructions, parking, which door to use" value={d.access} onChange={set('access')} /></label>
            {errP}
            {btns('Save access details', () => run(() => saveServiceAccess(sv.id, d.access)))}
          </>}
        </div>

        <div className="cpsec">
          <div className="cpcardh"><h3 className="cpsh">Scope of works</h3>
            {sv.sow.length > 0 && <button type="button" className="linkbtn" onClick={() => setSowOpen(o => ({ ...o, [i]: !o[i] }))}>{sowOpen[i] ? 'Hide checklist' : 'Show checklist'}</button>}
          </div>
          {sv.sow.length > 0
            ? <p className="cpnone">{sv.sow.length + (sv.sow.length === 1 ? ' heading, ' : ' headings, ') + sowN + (sowN === 1 ? ' task' : ' tasks')}. Cleaners see this list on each visit.</p>
            : <p className="cpnone">No scope checklist on file.</p>}
          {sowOpen[i] && sv.sow.length > 0 && (
            <div className="sow">
              {sv.sow.map((h, hi) => (
                <div className="sowsec" key={hi}>
                  <h4 className="sowh">{h.heading}</h4>
                  <ul className="sowlist">{h.items.map((it, ii) => <li key={ii}><span className="box" aria-hidden="true" /><span className="sowt">{it.text}</span><span className={it.freq === 'Every visit' ? 'ftag' : 'ftag periodic'}>{it.freq}</span></li>)}</ul>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="cpsec">
          <h3 className="cpsh">Additional services</h3>
          {sv.addons.map(ex => {
            const dk = ex.id, confirming = delX === dk, dueKey = 'due:' + i + ':' + ex.id, editingDue = edit === dueKey, its = addonTasks(ex)
            return (
              <Fragment key={ex.id}>
                <div className="cpx">
                  <span className="cpxm"><strong>{ex.name}</strong>
                    <span>{(ADDON_FREQ_LABEL[ex.freq] || ex.freq) + ' · ' + (ex.price > 0 ? fmt$(ex.price) + ' a visit (cleaner ' + fmt$(ex.cost) + ')' : 'price not on file. Remove it and add it again with the price')}</span>
                    <span className={ex.next ? 'cpxdue' : 'cpxdue warn'}>{ex.next ? (ex.freq === 'once' ? 'Booked for ' : 'Next due ') + dLong(ex.next) + '. Shows in the cleaner app on the first clean from then.' : 'No due date yet, so cleaners won’t see it. Set one.'}</span>
                  </span>
                  {!confirming
                    ? <span className="cpxbtns"><button type="button" className="linkbtn" onClick={() => open(dueKey, { next: ex.next || '' })} aria-label={(ex.next ? 'Change due date for ' : 'Set due date for ') + ex.name}>{ex.next ? 'Change due date' : 'Set due date'}</button><button type="button" className="linkbtn danger" onClick={() => { setDelX(dk); close(); setPick(null) }} aria-label={'Remove ' + ex.name}>Remove</button></span>
                    : <span className="cpbtns"><button type="button" className="btn call dangerfill" disabled={busy} onClick={() => run(() => removeAddon(ex.id))}>Remove it</button><button type="button" className="btn log" onClick={() => setDelX(null)}>Keep</button></span>}
                </div>
                {its.length > 0 && <ul className="cpxitems">{its.map((t, ti) => <li key={ti}>{t}</li>)}</ul>}
                {editingDue && (
                  <div className="extracard" role="form">
                    <label className="fld half"><span>Next due</span><input type="date" min={today} value={d.next} onChange={set('next')} /></label>
                    {errP}
                    {btns('Save date', () => run(() => setAddonDue(ex.id, d.next)))}
                  </div>
                )}
              </Fragment>
            )
          })}
          {!sv.addons.length && <p className="cpnone">None yet.</p>}
          {adding ? (
            <div className="extracard" role="form">
              <div className="ncgrid">
                <label className="fld half"><span>Service</span>
                  <select value={d.kind} onChange={e => {
                    const v = e.target.value
                    setD(x => {
                      const prev = presetFor(x.kind).join('\n'), now = (x.items || []).join('\n')
                      return { ...x, kind: v, items: !now.trim() || now === prev ? (presetFor(v).length ? presetFor(v) : ['']) : x.items }
                    }); setErr('')
                  }}>
                    <option value="">Choose a service</option>
                    {EXTRA_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </label>
                <label className="fld half"><span>Frequency</span>
                  <select value={d.freq} onChange={set('freq')}>
                    <option value="">Choose how often</option>
                    {EXTRA_FREQS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </label>
                {d.kind === 'Custom' && <label className="fld span2"><span>Custom service name</span><input type="text" autoComplete="off" maxLength={200} placeholder="e.g. High dusting" value={d.custom} onChange={set('custom')} /></label>}
                <label className="fld half"><span>My charge per visit ($, ex GST)</span><input type="text" inputMode="decimal" autoComplete="off" placeholder="e.g. 350" value={d.price} onChange={set('price')} /></label>
                <label className="fld half"><span>Cleaner cost per visit ($)</span><input type="text" inputMode="decimal" autoComplete="off" placeholder="e.g. 220" value={d.cost} onChange={set('cost')} /></label>
                <label className="fld half"><span>First due <span className="req" aria-hidden="true">*</span><span className="sr">(required)</span></span><input type="date" min={today} value={d.next} onChange={set('next')} /></label>
              </div>
              <p className="nchint">Cleaners see it on the first clean on or after this date. After it’s marked done, the next date moves on by the frequency.</p>
              <div className="addsow">
                <span className="addsowh">What’s included</span>
                {!items.length && <p className="nchint">Choose a service to load its standard list, or add your own tasks.</p>}
                {items.map((t, ti) => (
                  <div className="sowiedit" key={ti}>
                    <input type="text" className="sowin" maxLength={300} value={t} onChange={e => { const v = e.target.value; setItems(l => { l[ti] = v; return l }) }} aria-label="Task" />
                    <button type="button" className="iconbtn" onClick={() => setItems(l => { l.splice(ti, 1); return l })} aria-label={'Remove task ' + (t || ti + 1)}><X /></button>
                  </div>
                ))}
                <div className="addsowbtns">
                  <button type="button" className="linkbtn" onClick={() => setItems(l => (l.length < 30 ? [...l, ''] : l))}>+ Add task</button>
                  {presetFor(d.kind).length > 0 && <button type="button" className="linkbtn" onClick={() => setItems(() => presetFor(d.kind))}>Reset to standard list</button>}
                </div>
              </div>
              {addMoney && <p className={addMoney.cls}>{addMoney.text}</p>}
              {errP}
              {btns('Add service', () => run(() => addAddon(sv.id, { kind: d.kind, custom: d.custom, freq: d.freq, price: d.price, cost: d.cost, next: d.next, items })))}
            </div>
          ) : (
            sv.addons.length < 10 && <button type="button" className="btn log addsite" onClick={() => open(addKey, { kind: '', custom: '', freq: '', price: '', cost: '', next: '', items: [] })}><Plus />Add a service</button>
          )}
        </div>
      </section>
    )
  }

  const pausing = edit === 'pause', ending = edit === 'end'
  const reasons = ending ? END_REASONS : PAUSE_REASONS

  return (
    <>
      <Link className="back" href={backHref}><Back /> {backLabel}</Link>
      <div className="cphead">
        <div className="cpwho">
          <h1 className="greet">{c.name}</h1>
          <p className="cpsub">{c.suburb} <span className={'h ' + stats.health}>{stats.health === 'low' ? 'Low margin' : stats.health === 'watch' ? 'Watch' : 'Healthy'}</span></p>
        </div>
      </div>
      {st === 'paused' && <div className="agstatus warn cpbanner"><span>{statusText}</span>{resumeBtn('btn log')}</div>}
      {st === 'ended' && <div className="agstatus cpbanner"><span>{statusText}</span>{reactBtn('btn log')}</div>}
      <div className="cpstats">
        <div><span>Monthly, ex GST</span><strong>{stats.mrr}</strong></div>
        <div><span>Margin</span><strong>{stats.margin}</strong></div>
        <div><span>Sites</span><strong>{String(c.multi ? c.services.length : 1)}</strong></div>
        <div><span>Cleans a month</span><strong>{String(visits)}</strong></div>
      </div>

      <section className="addcard cpcard" aria-label="Business details">
        <div className="cpcardh"><h2 className="nch">Business details</h2>
          {edit !== 'details' && <button type="button" className="btn log" onClick={() => open('details', { contact: c.contact, phone: c.phone, email: c.email, street: c.street, suburb: c.suburb, postcode: c.postcode, state: c.state || 'QLD' })}>Edit</button>}
        </div>
        {edit !== 'details' ? (
          <dl className="cpkv">
            <div><dt>Contact</dt><dd>{c.contact || 'Not on file'}</dd></div>
            <div><dt>Phone</dt><dd>{c.phone ? <a href={'tel:' + c.phone.replace(/\s/g, '')}>{c.phone}</a> : 'Not on file'}</dd></div>
            <div><dt>Email</dt><dd>{c.email ? <a href={'mailto:' + c.email}>{c.email}</a> : 'Not on file'}</dd></div>
            <div><dt>Address</dt><dd>{addr || 'Not on file'}</dd></div>
          </dl>
        ) : (
          <div role="form" className="ncform">
            <div className="ncgrid">
              <label className="fld half"><span>Contact name</span><input type="text" autoComplete="off" maxLength={200} value={d.contact} onChange={set('contact')} /></label>
              <label className="fld half"><span>Contact phone</span><input type="tel" autoComplete="off" placeholder="07 XXXX XXXX" value={d.phone} onChange={set('phone')} /></label>
              <label className="fld span2"><span>Contact email</span><input type="email" autoComplete="off" autoCapitalize="off" value={d.email} onChange={set('email')} /></label>
              <label className="fld span2"><span>Street address</span><input type="text" autoComplete="off" maxLength={300} value={d.street} onChange={set('street')} /></label>
              <label className="fld subf"><span>Suburb</span><input type="text" autoComplete="off" maxLength={100} value={d.suburb} onChange={set('suburb')} /></label>
              <label className="fld pc"><span>Postcode</span><input type="text" inputMode="numeric" maxLength={4} autoComplete="off" value={d.postcode} onChange={set('postcode')} /></label>
              <label className="fld half"><span>State</span><select value={d.state} onChange={set('state')}>{STATES.map(s => <option key={s} value={s}>{s}</option>)}</select></label>
            </div>
            {errP}
            {btns('Save details', () => run(() => saveClientDetails(c.id, { contact: d.contact, phone: d.phone, email: d.email, street: d.street, suburb: d.suburb, postcode: d.postcode, state: d.state })))}
          </div>
        )}
      </section>

      {c.services.map(serviceCard)}
      {!c.services.length && <section className="addcard cpcard"><h2 className="nch">Service details</h2><p className="cpnone">No cleans set up for this client yet.</p></section>}

      {photos}

      <section className="addcard cpcard" aria-label="Requests from the client">
        <div className="cpcardh"><h2 className="nch">Requests</h2><Link className="linkbtn" href={`/hub/commercial/requests?show=all&q=${encodeURIComponent(c.name)}`}>Open in Requests</Link></div>
        {requests.slice(0, 5).map(q => {
          const s9 = rqState(q)
          return <div className="cpdoc" key={q.id}><span className="cpxm"><strong>{rqTitle(q)}</strong><span>{[q.site, 'sent ' + dShort(q.created)].filter(Boolean).join(' · ')}</span></span><span className={s9.tagCls}>{s9.tag}</span></div>
        })}
        {!requests.length && <p className="cpnone">Nothing sent from their portal yet.</p>}
        {requests.length > 5 && <p className="cpnone">Showing the latest 5 of {requests.length}.</p>}
      </section>

      <section className="addcard cpcard" aria-label="Problems reported">
        <div className="cpcardh"><h2 className="nch">Problems reported</h2>{problems.length > 0 && <Link className="linkbtn" href="/hub/problems">Open in Problems</Link>}</div>
        {problems.map(p => (
          <div className="cpdoc" key={p.id}><span className="cpxm"><strong>{p.body}</strong><span>{[p.when, p.cleaner, p.site].filter(Boolean).join(' · ')}</span></span><span className={p.fixed ? 'tag wt' : 'tag expiring'}>{p.fixed ? 'Fixed' : 'Open'}</span></div>
        ))}
        {!problems.length && <p className="cpnone">Nothing reported by cleaners.</p>}
      </section>

      <section className="addcard cpcard" aria-label="Client status">
        <h2 className="nch">Client status</h2>
        {!pausing && !ending && <>
          {st === 'active' && <>
            <p className="cpnone">Pausing stops their cleans for a while. Ending moves them to Ended clients. Both keep every detail, document and note, and you can undo either.</p>
            <div className="cpbtns">
              <button type="button" className="btn log" onClick={() => open('pause', { from: today, resume: '', reason: '', note: '' })}>Pause service</button>
              <button type="button" className="btn log dangerbtn" onClick={() => open('end', { last: today, reason: '', note: '' })}>End service</button>
            </div>
          </>}
          {st === 'paused' && <div className="cpbtns">{resumeBtn('btn call')}<button type="button" className="btn log dangerbtn" onClick={() => open('end', { last: today, reason: '', note: '' })}>End service</button></div>}
          {st === 'ended' && <div className="cpbtns">{reactBtn('btn call')}</div>}
        </>}
        {(pausing || ending) && (
          <div role="form" className="ncform">
            <div className="ncgrid">
              {pausing ? <>
                <label className="fld half"><span>No cleans from</span><input type="date" min={today} value={d.from} onChange={set('from')} /></label>
                <label className="fld half"><span>Restart on (optional)</span><input type="date" min={today} value={d.resume} onChange={set('resume')} /></label>
              </> : <label className="fld half"><span>Last clean</span><input type="date" value={d.last} onChange={set('last')} /></label>}
            </div>
            <div className="fld" role="radiogroup" aria-label="Reason"><span>Reason</span>
              <div className="cpradio">
                {reasons.map(r => <label className="check" key={r}><input type="radio" name="cpreason" checked={d.reason === r} onChange={() => { setD(x => ({ ...x, reason: r })); setErr('') }} /><span>{r}</span></label>)}
              </div>
            </div>
            <label className="fld"><span>Note (optional, needed for Other)</span><textarea rows={2} maxLength={500} value={d.note} onChange={set('note')} /></label>
            {ending && <p className="cpnote">Their cleans stop after the last clean date and the cleaners stop seeing the site. Their details, agreement and history stay under Ended clients.</p>}
            {errP}
            {pausing
              ? btns('Pause service', () => run(() => pauseClient(c.id, d.from, d.resume, d.reason, d.note)))
              : btns('End service', () => run(() => endClient(c.id, d.last, d.reason, d.note)), 'btn call dangerfill')}
          </div>
        )}
        {history.length > 0 && <>
          <h3 className="cpsh">History</h3>
          <ul className="cphist">{history.map((y, k) => <li key={k}><time>{dShort(y.date)}</time><span>{y.text}</span></li>)}</ul>
        </>}
      </section>

      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button type="button" className="undo" onClick={() => setToast('')} aria-label="Dismiss">OK</button>
        </div>
      )}
    </>
  )
}
