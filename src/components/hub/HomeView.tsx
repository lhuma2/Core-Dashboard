'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Back } from './icons'
import { setFlash, takeFlash } from '@/lib/hub/flash'
import { createAgreement } from '@/actions/hub-agreements'
import {
  setHomeCleaner, setHomeTime, pauseHome, resumeHome, endHome, reactivateHome, markHomeDone, cancelHomeClean, reopenHome, deleteHome,
} from '@/actions/hub-homes'
import {
  rState, homeNext, perMonth, moneyLine, timeText, STATE_TXT, STATE_CLS, addr, freqLong, homeText, longDate, dLong, dShort, cash, cash2,
  type Home, type History,
} from '@/lib/hub/homes'
import { docMeta, docTag, AGR_TITLE, type HomeDoc } from '@/lib/hub/home-agreements'
import { isoAdd } from '@/lib/hub/timetable'

type Act = null | 'time' | 'pause' | 'end' | 'cancel' | 'delete'
type R = { ok: true; id: string; toast: string } | { ok: false; error: string; needDate?: true }

// The residential client's page: status, money, details, cleans, agreement, status actions and history. Mock-up words.
const FROM: Record<string, [string, string]> = { timetable: ['/hub/residential/timetable', 'Timetable'], team: ['/hub/residential/team', 'Team'] }

export function HomeView({ h, history, docs, cleaners, today, from }: { h: Home; history: History[]; docs: HomeDoc[]; cleaners: { id: string; name: string }[]; today: string; from?: string }) {
  const [backHref, backLabel] = FROM[from || ''] || ['/hub/residential/clients', 'Residential']
  const router = useRouter()
  const [act, setAct] = useState<Act>(null)
  const [d1, setD1] = useState('')
  const [d2, setD2] = useState('')
  const [note, setNote] = useState('')
  const [ts, setTs] = useState('')
  const [tf, setTf] = useState('')
  const [err, setErr] = useState('')
  const [toast, setToast] = useState('')
  const [busy, start] = useTransition()
  useEffect(() => { const m = takeFlash(); if (m) setToast(m) }, [])

  const hs = rState(h, today), ml = moneyLine(h.price, h.cost)
  const nexts = h.kind === 'oneoff' ? [] : homeNext(h, today, 4)
  const cleanerName = (id: string | null) => { const c = cleaners.find(x => x.id === id); return c ? c.name.split(/\s+/)[0] : 'Unassigned' }
  const hasSigned = docs.some(d => d.status === 'signed'), hasOpen = docs.some(d => d.status === 'draft' || d.status === 'sent')
  const finished = hs === 'ended' || hs === 'done' || hs === 'cancelled'
  const go = (a: Act, x: Partial<{ d1: string; d2: string; ts: string; tf: string }> = {}) => { setAct(a); setErr(''); setNote(''); setD1(x.d1 || ''); setD2(x.d2 || ''); setTs(x.ts || ''); setTf(x.tf || '') }
  const run = (p: () => Promise<R>, after?: (r: R & { ok: true }) => void) => start(async () => {
    const r = await p()
    if (!r.ok) {
      if ('needDate' in r && r.needDate) { setFlash(r.error); router.push(`/hub/residential/clients/${h.id}/edit?redate=1`); return }
      setErr(r.error); if (!act) setToast(r.error); return
    }
    setAct(null); setErr('')
    if (after) { after(r); return }
    if (r.toast) setToast(r.toast)
    router.refresh()
  })

  const banner = hs === 'paused' ? 'Paused from ' + dLong(h.paused_from) + (h.resume_on ? ', restarts ' + dLong(h.resume_on) : ', no restart date yet') + '.'
    : hs === 'ended' ? (h.ended_on && h.ended_on >= today ? 'Ending. Last clean ' + dLong(h.ended_on) + '.' : 'Service ended' + (h.ended_on ? ' ' + dLong(h.ended_on) : '') + '.')
      : hs === 'cancelled' ? 'This one-off was cancelled.'
        : hs === 'overdue' ? 'This clean was on ' + dLong(h.first_clean) + '. Mark it done, or move it if it didn’t happen.' : ''
  const canDone = (hs === 'booked' || hs === 'overdue') && (h.first_clean || '') <= today
  const doneBtn = <button type="button" className="btn call" disabled={busy} onClick={() => run(() => markHomeDone(h.id))}>Mark done</button>
  const resumeBtn = (cls: string) => <button type="button" className={cls} disabled={busy} onClick={() => run(() => resumeHome(h.id))}>Resume now</button>
  const reactBtn = (cls: string) => <button type="button" className={cls} disabled={busy} onClick={() => run(() => reactivateHome(h.id))}>Reactivate</button>
  const errP = err ? <p className="ferr" role="alert">{err}</p> : null

  return (
    <>
      <Link className="back" href={backHref}><Back /> {backLabel}</Link>
      <div className="cphead">
        <div className="cpwho">
          <h1 className="greet">{h.name}</h1>
          <p className="cpsub">{h.suburb} <span className="tag draft">{h.kind === 'oneoff' ? 'One-off' : 'Recurring'}</span> <span className={STATE_CLS[hs]}>{STATE_TXT[hs]}</span></p>
        </div>
        <Link className="btn log" href={`/hub/residential/clients/${h.id}/edit`}>Edit</Link>
      </div>
      {banner && (
        <div className={hs === 'ended' || hs === 'cancelled' ? 'agstatus cpbanner' : 'agstatus warn cpbanner'}><span>{banner}</span>
          {hs === 'paused' && resumeBtn('btn log')}
          {hs === 'ended' && reactBtn('btn log')}
          {canDone && doneBtn}
        </div>
      )}
      <div className="cpstats">
        <div><span>Per clean, incl GST</span><strong>{h.price > 0 ? cash(h.price) : 'No price'}</strong></div>
        <div><span>Margin</span><strong>{!(h.price > 0) ? 'Add price' : ml && h.cost > 0 ? ml.pct + '%' : 'Add cleaner cost'}</strong></div>
        <div><span>{h.kind === 'oneoff' ? 'Clean date' : 'Cleans a month'}</span><strong>{h.kind === 'oneoff' ? dShort(h.first_clean) : String(Math.round(perMonth(h) * 10) / 10)}</strong></div>
        <div><span>{h.kind === 'oneoff' ? 'Cleaner' : 'Monthly, ex GST'}</span><strong>{h.kind === 'oneoff' ? cleanerName(h.cleaner_id) : cash(Math.round((h.price / 1.1) * perMonth(h)))}</strong></div>
      </div>

      <section className="addcard cpcard" aria-label="Client details">
        <div className="cpcardh"><h2 className="nch">Details</h2><Link className="linkbtn" href={`/hub/residential/clients/${h.id}/edit`}>Edit</Link></div>
        <dl className="cpkv">
          <div><dt>Phone</dt><dd>{h.phone ? <a href={'tel:' + h.phone.replace(/[^\d+]/g, '')}>{h.phone}</a> : 'Not on file'}</dd></div>
          <div><dt>Email</dt><dd>{h.email ? <a href={'mailto:' + h.email}>{h.email}</a> : 'Not on file'}</dd></div>
          <div><dt>Address</dt><dd>{addr(h) || 'Not on file'}</dd></div>
          <div><dt>Home</dt><dd>{homeText(h)}</dd></div>
          <div><dt>Access and notes</dt><dd>{h.notes || 'None'}</dd></div>
        </dl>
      </section>

      <section className="addcard cpcard" aria-label="Cleans">
        <div className="cpcardh"><h2 className="nch">Cleans</h2><Link className="linkbtn" href={`/hub/residential/clients/${h.id}/edit`}>Change</Link></div>
        <dl className="cpkv">
          <div><dt>How often</dt><dd>{freqLong(h)}</dd></div>
          <div><dt>Time</dt><dd>{timeText(h)}</dd></div>
          <div><dt>{h.kind === 'oneoff' ? 'Date' : 'First clean'}</dt><dd>{h.first_clean ? dLong(h.first_clean) : 'Not set'}</dd></div>
          <div><dt>Client price</dt><dd>{h.price > 0 ? cash2(h.price) + ' incl GST' : 'Not set'}</dd></div>
          <div><dt>Cleaner cost</dt><dd>{h.cost > 0 ? cash2(h.cost) : 'Not set'}</dd></div>
          {h.windows_price ? <div><dt>Windows add-on</dt><dd>{cash2(h.windows_price)} incl GST{h.kind === 'oneoff' ? '' : ', ' + ({ each: 'every clean', monthly: 'once a month', quarterly: 'every 3 months', once: 'once only' } as Record<string, string>)[h.windows_freq || 'monthly']}</dd></div> : null}
        </dl>
        {ml && <p className={ml.cls}>{ml.text}</p>}
        {!finished && <>
          {act === 'time' ? (
            <div role="form" className="ncform">
              <div className="ncgrid">
                <label className="fld q"><span>Start time</span><input type="time" value={ts} onChange={e => { setTs(e.target.value); setErr('') }} /></label>
                <label className="fld q"><span>Finish time</span><input type="time" value={tf} onChange={e => { setTf(e.target.value); setErr('') }} /></label>
              </div>
              <p className="fhint">Applies to every clean from now on. The cleaner sees it in their app.</p>
              {errP}
              <div className="cpbtns"><button type="button" className="btn call" disabled={busy} onClick={() => run(() => setHomeTime(h.id, ts, tf))}>Save time</button><button type="button" className="btn log" onClick={() => go(null)}>Cancel</button></div>
            </div>
          ) : <>
            {!(h.start_time && h.finish_time) && <p className="agstatus warn">{h.start_time ? 'No finish time yet. Add it so you and the cleaner can see how long the clean runs.' : 'No time set yet, so the cleaner app can’t show when to arrive. Set it now.'}</p>}
            <button type="button" className="btn log rctime" onClick={() => go('time', { ts: h.start_time || '', tf: h.finish_time || '' })}>{h.start_time ? 'Change time' : 'Set time'}</button>
          </>}
          <label className="fld rcclean"><span>Cleaner</span>
            <select value={h.cleaner_id || ''} disabled={busy} onChange={e => { const v = e.target.value; run(() => setHomeCleaner(h.id, v)) }}>
              <option value="">Unassigned</option>
              {cleaners.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </>}
        {h.kind !== 'oneoff' && <>
          <h3 className="cpsh">Next cleans</h3>
          {nexts.length
            ? <ul className="cphist">{nexts.map(d => <li key={d}><span>{longDate(d)}{d === today ? ' (today)' : ''}</span></li>)}</ul>
            : <p className="cpnone">{hs === 'ended' ? 'No more cleans.' : hs === 'paused' && !h.resume_on ? 'No cleans until you resume them.' : 'No cleans coming up.'}</p>}
        </>}
      </section>

      <section className="addcard cpcard" aria-label="Agreement and files">
        <div className="cpcardh"><h2 className="nch">Agreement and files</h2><Link className="linkbtn" href="/hub/residential/documents">Open in Documents</Link></div>
        {docs.map(d => {
          const [tag, cls] = docTag(d)
          return (
            <div className="cpdoc" key={d.id}>
              <span className="cpxm"><strong>{AGR_TITLE} <span className={cls}>{tag}</span></strong><span>{d.ref} · {docMeta(d)}</span></span>
              <Link className="btn log" href={`/hub/residential/documents/${d.id}`} aria-label={'Open ' + d.ref}>Open</Link>
            </div>
          )
        })}
        {!docs.length && <p className="cpnone">No agreement or files yet.</p>}
        {!hasOpen && !finished && (
          <div className="cpbtns"><button type="button" className={hasSigned ? 'btn log' : 'btn call'} disabled={busy} onClick={() => run(() => createAgreement(h.id), r => { setFlash(r.toast); router.push(`/hub/residential/documents/${r.id}`) })}>{hasSigned ? 'Send a new agreement' : 'Create agreement'}</button></div>
        )}
      </section>

      <section className="addcard cpcard" aria-label="Client status">
        <h2 className="nch">Status</h2>
        {(!act || act === 'time') && <>
          {h.kind !== 'oneoff' && (hs === 'active' || hs === 'starting') && <>
            <p className="cpnone">Pausing stops their cleans for a while. Ending moves them to Finished. Both keep every detail, document and note, and you can undo either.</p>
            <div className="cpbtns">
              <button type="button" className="btn log" onClick={() => go('pause', { d1: today < (h.first_clean || '') ? h.first_clean! : today })}>Pause cleans</button>
              <button type="button" className="btn log dangerbtn" onClick={() => go('end', { d1: homeNext(h, today, 1)[0] || today })}>End service</button>
            </div>
          </>}
          {hs === 'paused' && <div className="cpbtns">{resumeBtn('btn call')}<button type="button" className="btn log dangerbtn" onClick={() => go('end', { d1: homeNext({ ...h, status: 'active' }, today, 1)[0] || today })}>End service</button></div>}
          {hs === 'ended' && <div className="cpbtns">{reactBtn('btn call')}</div>}
          {(hs === 'booked' || hs === 'overdue') && <>
            {hs === 'booked' && (h.first_clean || '') > today && <p className="cpnone">You can mark it done on the day. To move it, tap Edit and change the date.</p>}
            <div className="cpbtns">{canDone && doneBtn}<button type="button" className="btn log dangerbtn" onClick={() => go('cancel')}>Cancel this clean</button></div>
          </>}
          {(hs === 'done' || hs === 'cancelled') && <>
            <p className="cpnone">Want them back on a schedule? Tap Edit and switch to Recurring.</p>
            <div className="cpbtns"><button type="button" className="btn log" disabled={busy} onClick={() => run(() => reopenHome(h.id))}>Book it again</button></div>
          </>}
          {!hasSigned && <div className="cpbtns"><button type="button" className="linkbtn danger" onClick={() => go('delete')}>Delete client (for mistakes)</button></div>}
        </>}
        {act === 'pause' && (
          <div role="form" className="ncform">
            <div className="ncgrid">
              <label className="fld half"><span>No cleans from</span><input type="date" min={today} value={d1} onChange={e => { setD1(e.target.value); setErr('') }} /></label>
              <label className="fld half"><span>Restart on (optional)</span><input type="date" min={today} value={d2} onChange={e => { setD2(e.target.value); setErr('') }} /></label>
            </div>
            <label className="fld"><span>Note (optional)</span><textarea rows={2} value={note} onChange={e => setNote(e.target.value)} /></label>
            {errP}
            <div className="cpbtns"><button type="button" className="btn call" disabled={busy} onClick={() => run(() => pauseHome(h.id, d1, d2, note))}>Pause cleans</button><button type="button" className="btn log" onClick={() => go(null)}>Cancel</button></div>
          </div>
        )}
        {act === 'end' && (
          <div role="form" className="ncform">
            <div className="ncgrid"><label className="fld half"><span>Last clean</span><input type="date" min={isoAdd(today, -1)} value={d1} onChange={e => { setD1(e.target.value); setErr('') }} /></label></div>
            <label className="fld"><span>Reason (optional)</span><textarea rows={2} value={note} onChange={e => setNote(e.target.value)} /></label>
            <p className="cpnote">Their cleans stop after the last clean and the cleaner stops seeing the home. Their agreement asks for 14 days’ notice.</p>
            {errP}
            <div className="cpbtns"><button type="button" className="btn call dangerfill" disabled={busy} onClick={() => run(() => endHome(h.id, d1, note))}>End service</button><button type="button" className="btn log" onClick={() => go(null)}>Cancel</button></div>
          </div>
        )}
        {act === 'cancel' && (
          <div role="form" className="ncform">
            <label className="fld"><span>Reason (optional)</span><textarea rows={2} value={note} onChange={e => setNote(e.target.value)} /></label>
            <p className="cpnote">Under their terms, cancelling with less than 24 hours’ notice can be charged up to the full clean.</p>
            {errP}
            <div className="cpbtns"><button type="button" className="btn call dangerfill" disabled={busy} onClick={() => run(() => cancelHomeClean(h.id, note))}>Cancel the clean</button><button type="button" className="btn log" onClick={() => go(null)}>Keep it</button></div>
          </div>
        )}
        {act === 'delete' && <>
          <div className="inlineconfirm">
            <span>Delete {h.name} for good? Use this for a mistake. {docs.length ? `Their ${docs.length}${docs.length === 1 ? ' document goes' : ' documents go'} too.` : ''}</span>
            <button type="button" className="btn call dangerfill" disabled={busy} onClick={() => run(() => deleteHome(h.id), r => { setFlash(r.toast); router.push('/hub/residential/clients'); router.refresh() })}>Yes, delete</button>
            <button type="button" className="btn log" onClick={() => go(null)}>Keep</button>
          </div>
          {errP}
        </>}
        {history.length > 0 && <>
          <h3 className="cpsh">History</h3>
          <ul className="cphist">{history.map((y, i) => <li key={i}><time>{dShort(y.date)}</time><span>{y.text}</span></li>)}</ul>
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
