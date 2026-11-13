'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { replyRequest, markRequestDone, reopenRequest, bookExtraClean } from '@/actions/hub-requests'
import { type HubRequest, rqTitle, rqState, rqNeedsYou, rqDay, rqAge, rqPropLine } from '@/lib/hub/requests'
import { dShort } from '@/lib/hub/home-quotes'
import { t12 } from '@/lib/hub/timetable'

type R = { ok: true; toast: string } | { ok: false; error: string }
type F = 'open' | 'done' | 'all'
const NO_DB = 'Couldn’t reach the hub. Check your connection and try again.'
const fmt2 = (n: number) => { const r = (Math.round(n * 100) / 100).toFixed(2).split('.'); return '$' + r[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + r[1] }
const crew = (a: string[]) => (a.length ? a.join(', ') : 'Unassigned')

export function SearchIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
}

/** One request card. Used on Commercial → Requests and on the client page. */
export function RequestCard({ r, today, from, busy, act, open, setOpen }: {
  r: HubRequest; today: string; from: 'requests' | 'client'
  busy: boolean; act: (fn: () => Promise<R>, after?: () => void) => Promise<string>
  open: { id: string; mode: 'reply' | 'book' } | null; setOpen: (o: { id: string; mode: 'reply' | 'book' } | null) => void
}) {
  const s = rqState(r)
  const [text, setText] = useState('')
  const [bd, setBd] = useState('')
  const [bt, setBt] = useState('')
  const [err, setErr] = useState('')
  const replying = open?.id === r.id && open.mode === 'reply'
  const booking = open?.id === r.id && open.mode === 'book'
  const isOpen = s.key !== 'done'
  const bits: string[] = []
  if (r.site) bits.push(r.site)
  if (r.cleanDate) bits.push('Clean on ' + rqDay(r.cleanDate))
  if (r.wantDate) bits.push((r.kind === 'extra' ? 'Wanted ' : 'Suits ') + rqDay(r.wantDate))
  bits.push('Sent ' + rqAge(r.created, today))
  const sv = r.kind === 'extra' ? r.svc : null
  const bk = r.booked
  const bookText = !sv ? '' : (sv.cleaners.length ? `With ${crew(sv.cleaners)}${sv.cleaners.length > 1 ? ', the cleaners' : ', the cleaner'} on that site. ` : 'No cleaner is on that site yet, so assign one on the client page. ')
    + `It goes on the calendar and their jobs, and ${r.client} gets an email and sees it in their portal.` + (sv.price ? ` Charged at their usual ${fmt2(sv.price)} ex GST per clean.` : '')
  const cls = 'probcard rqcard' + (s.key === 'done' ? ' fixed' : rqNeedsYou(r) ? '' : ' going')
  const close = () => { setOpen(null); setErr(''); setText('') }
  const run = async (fn: () => Promise<R>) => { setErr(''); const e = await act(fn, close); if (e) setErr(e) }

  return (
    <article className={cls} data-rq={r.id}>
      <div className="probhead">
        <span className="rqwho"><span className="rqclient">{r.client}</span><span className="rqtitle">{rqTitle(r)}</span></span>
        <span className={s.tagCls}>{s.tag}</span>
      </div>
      <div className="probmeta">{bits.join(' · ')}</div>
      {r.detail && <p className="probtext">{r.detail}</p>}
      {r.reply && <p className="rqline">You replied {r.repliedAt === today ? 'today' : dShort(r.repliedAt).replace(/ \d{4}$/, '')}: “{r.reply}”</p>}
      {r.prop && <p className="rqline">{rqPropLine(r.prop)}</p>}
      {bk && bk.start && (
        <p className="rqline">Booked {rqDay(bk.date)} at {t12(bk.start)}{sv && sv.cleaners.length ? ` with ${crew(sv.cleaners)}` : ', no cleaner assigned yet'}{r.wantDate && bk.date !== r.wantDate ? ` (they asked for ${rqDay(r.wantDate)})` : ''}. It’s on the calendar.</p>
      )}
      {replying && (
        <div role="form" className="rqform" aria-label="Reply">
          <label className="fld"><span>Your reply</span>
            <textarea rows={3} value={text} autoFocus maxLength={2000} onChange={e => { setText(e.target.value); setErr('') }}
              placeholder={r.kind === 'photos' ? 'e.g. Here are 6 photos from Saturday’s clean.' : r.kind === 'quote' ? 'e.g. Thanks, I’ll have a quote to you by Thursday.' : 'e.g. Thanks, all sorted for the next clean.'} />
          </label>
          <p className="cpnote">Emailed to them from admin@corecleaning.services and shown under this request in their portal.</p>
          {err && <p className="ferr" role="alert">{err}</p>}
          <div className="sheetbtns">
            <button type="button" className="btn call" disabled={busy} onClick={() => run(() => replyRequest(r.id, text))}>{busy ? 'Sending…' : 'Send reply'}</button>
            <button type="button" className="btn log" onClick={close}>Cancel</button>
          </div>
        </div>
      )}
      {booking && (
        <div role="form" className="rqform" aria-label="Book the extra clean">
          <div className="ncgrid">
            <label className="fld half"><span>Day</span><input type="date" min={today} value={bd} onChange={e => { setBd(e.target.value); setErr('') }} /></label>
            <label className="fld half"><span>Start time</span><input type="time" value={bt} onChange={e => { setBt(e.target.value); setErr('') }} /></label>
          </div>
          {!!r.wantDate && !!bd && bd !== r.wantDate && (
            <p className="rqline">They asked for {rqDay(r.wantDate)}. Booking a different day tells them in the email: “{rqDay(r.wantDate)} wasn’t available, so we’ve booked you in for {rqDay(bd)}.”</p>
          )}
          {bookText && <p className="cpnote">{bookText}</p>}
          {err && <p className="ferr" role="alert">{err}</p>}
          <div className="sheetbtns">
            <button type="button" className="btn call" disabled={busy} onClick={() => run(() => bookExtraClean(r.id, bd, bt))}>{busy ? 'Booking…' : 'Book the extra clean'}</button>
            <button type="button" className="btn log" onClick={close}>Cancel</button>
          </div>
        </div>
      )}
      {!replying && !booking && (
        <div className="sheetbtns">
          {isOpen && r.kind === 'quote' && !r.prop && <Link className="btn call" href={`/hub/commercial/documents/proposals/new?type=spec&request=${r.id}`}>Start quote</Link>}
          {r.prop && <Link className="btn log" href={`/hub/commercial/documents/proposals/${r.prop.id}?from=requests`}>Open quote</Link>}
          {isOpen && r.kind === 'extra' && !bk && (
            <button type="button" className="btn call" disabled={busy} onClick={() => { setErr(''); setBd(r.wantDate && r.wantDate >= today ? r.wantDate : ''); setBt(sv?.start || '18:00'); setOpen({ id: r.id, mode: 'book' }) }}>Book it</button>
          )}
          {isOpen && <>
            <button type="button" className="btn log" disabled={busy} onClick={() => { setErr(''); setText(''); setOpen({ id: r.id, mode: 'reply' }) }}>Reply</button>
            <button type="button" className="btn log" disabled={busy} onClick={() => run(() => markRequestDone(r.id))}>Mark done</button>
          </>}
          {!isOpen && <button type="button" className="btn log" disabled={busy} onClick={() => run(() => reopenRequest(r.id))}>Reopen</button>}
          {from === 'requests'
            ? <Link className="linkbtn rqlink" href={`/hub/commercial/clients/${r.clientId}?from=requests`}>Client page</Link>
            : null}
        </div>
      )}
      {!replying && !booking && err && <p className="ferr" role="alert">{err}</p>}
    </article>
  )
}

/** Shared busy / toast handling for request cards. */
export function useRequestActs() {
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [open, setOpen] = useState<{ id: string; mode: 'reply' | 'book' } | null>(null)
  const [, start] = useTransition()
  const router = useRouter()
  const actFor = (id: string) => async (fn: () => Promise<R>, after?: () => void): Promise<string> => {
    setBusy(id)
    try {
      const r = await fn()
      if (!r.ok) return r.error
      after?.()
      setToast(r.toast)
      start(() => router.refresh())
      return ''
    } catch {
      return NO_DB
    } finally {
      setBusy(null)
    }
  }
  const toastEl = toast ? (
    <div className="toast" role="status">
      <span>{toast}</span>
      <button type="button" className="undo" onClick={() => setToast('')} aria-label="Dismiss">OK</button>
    </div>
  ) : null
  return { busy, open, setOpen, actFor, toastEl }
}

export function RequestList({ requests, today, initial, initialQuery }: { requests: HubRequest[]; today: string; initial: F; initialQuery: string }) {
  const [f, setF] = useState<F>(initial)
  const [q, setQ] = useState(initialQuery)
  const { busy, open, setOpen, actFor, toastEl } = useRequestActs()
  const qq = q.trim().toLowerCase()
  const match = (r: HubRequest) => !qq || (r.client + ' ' + rqTitle(r) + ' ' + r.site + ' ' + r.detail).toLowerCase().includes(qq)
  const inF = (r: HubRequest, x: F) => { const k = rqState(r).key; return x === 'all' ? true : x === 'done' ? k === 'done' : k !== 'done' }
  const shown = requests.filter(r => inF(r, f) && match(r))
  const empty = qq ? `No requests match "${q}".` : f === 'open' ? 'No open requests. All caught up.' : f === 'done' ? 'Nothing marked done yet.' : 'No requests yet.'
  return (
    <>
      <p className="sub rqsub"><span>Sent by clients from the Requests tab in their portal. Each one is emailed to admin@ too. Your replies and quotes show on their side.</span></p>
      <div className="toolbar">
        <label className="search">
          <SearchIcon />
          <span className="sr">Search requests</span>
          <input type="search" placeholder="Search requests" value={q} onChange={e => setQ(e.target.value)} />
        </label>
      </div>
      <div className="chips" role="group" aria-label="Show requests">
        {([['open', 'Open'], ['done', 'Done'], ['all', 'All']] as const).map(([id, label]) => (
          <button key={id} type="button" className={f === id ? 'chip on' : 'chip'} aria-pressed={f === id} onClick={() => { setF(id); setOpen(null) }}>
            {label} <span className="n">{requests.filter(r => inF(r, id) && match(r)).length}</span>
          </button>
        ))}
      </div>
      <div className="problist">
        {shown.map(r => <RequestCard key={r.id} r={r} today={today} from="requests" busy={busy === r.id} act={actFor(r.id)} open={open} setOpen={setOpen} />)}
        {shown.length === 0 && <div className="empty">{empty}</div>}
      </div>
      {toastEl}
    </>
  )
}
