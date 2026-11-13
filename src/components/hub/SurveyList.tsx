'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { SearchIcon } from './RequestList'
import { copy } from './ComplianceList'
import { sendSurvey, sendAllSurveys, snoozeSurvey, setSurveysOff, remindSurvey, surveyLink, followUpSurvey, undoFollowUp } from '@/actions/hub-surveys'
import { addMonths } from '@/lib/hub/figures'
import { dLong, dShort } from '@/lib/hub/home-quotes'
import { rqAge } from '@/lib/hub/requests'
import {
  SV_Q, type SvClient, type SvRec, svAvg, svFmt, svFlag, svCls, svOf, svWaitOf, svBase, svNext, svDue, svStatus,
} from '@/lib/hub/surveys'

type R = { ok: true; toast: string } | { ok: false; error: string }
export type SvF = 'due' | 'answers' | 'waiting' | 'schedule'
const NO_DB = 'Couldn’t reach the hub. Check your connection and try again.'
const PREVIEW_NOTE = 'Preview only, so nothing was saved. Their real answers land under Answers.'
const days = (from: string, to: string) => { const p = from.split('-'), q = to.split('-'); return Math.round((Date.UTC(+q[0], +q[1] - 1, +q[2]) - Date.UTC(+p[0], +p[1] - 1, +p[2])) / 86400000) }

export function SurveyList({ clients, surveys, today, initial, initialQuery, note }: {
  clients: SvClient[]; surveys: SvRec[]; today: string; initial: SvF; initialQuery: string; note: string
}) {
  const router = useRouter()
  const [, start] = useTransition()
  const [f, setF] = useState<SvF>(initial)
  const [q, setQ] = useState(initialQuery)
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState(note === 'preview' ? PREVIEW_NOTE : '')
  const [follow, setFollow] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  // the preview note is a one-off: take it out of the address so a refresh doesn't show it again
  useEffect(() => { if (note) window.history.replaceState(null, '', `/hub/commercial/surveys?f=${initial}`) }, [note, initial])

  const qq = q.trim().toLowerCase()
  const match = (n: string) => !qq || n.toLowerCase().includes(qq)
  const comm = clients.filter(c => svStatus(c, today) !== 'ended')
  const all = surveys.slice().sort((a, b) => (b.answeredAt || b.sentAt).localeCompare(a.answeredAt || a.sentAt) || b.id.localeCompare(a.id))
  const answered = all.filter(x => !!x.answeredAt)
  const waiting = all.filter(x => !x.answeredAt)
  const flagged = answered.filter(svFlag).length
  const yearAgo = addMonths(today, -12)
  const year = answered.filter(x => x.answeredAt! >= yearAgo)
  const sentYear = all.filter(x => x.sentAt >= yearAgo && x.sentAt <= today)
  const cat = SV_Q.map(qq2 => ({ label: qq2.label, avg: year.length ? year.reduce((t, x) => t + (+x.scores![qq2.k] || 0), 0) / year.length : 0 }))
  const weak = year.length ? cat.slice().sort((a, b) => a.avg - b.avg)[0] : null
  const overall = year.length ? year.reduce((t, x) => t + svAvg(x), 0) / year.length : 0
  const due = comm.filter(c => svDue(c, surveys, today)).sort((a, b) => svBase(a, surveys, today).localeCompare(svBase(b, surveys, today)) || a.name.localeCompare(b.name))
  const dueReady = due.filter(c => !!c.email)
  const byId = new Map(clients.map(c => [c.id, c]))

  async function run(key: string, fn: () => Promise<R>, after?: () => void) {
    setBusy(key)
    try {
      const r = await fn()
      if (!r.ok) { if (key.startsWith('fu')) setErr(r.error); else setToast(r.error); return }
      after?.(); setToast(r.toast)
      start(() => router.refresh())
    } catch { if (key.startsWith('fu')) setErr(NO_DB); else setToast(NO_DB) } finally { setBusy(null) }
  }
  const pick = (x: SvF) => { setF(x); setFollow(null); setErr('') }
  const clientLink = (id: string) => <Link className="linkbtn rqlink" href={`/hub/commercial/clients/${id}?from=surveys`}>Client page</Link>
  const preview = (c: string, from: SvF, s?: string) => <Link className="btn log" href={`/hub/commercial/surveys/${c}?from=${from}${s ? '&s=' + s : ''}`}>{s ? 'Open their survey' : 'Preview survey'}</Link>

  // ── To send ──
  const rowsD = f === 'due' ? due.filter(c => match(c.name)).map(c => {
    const b = svBase(c, surveys, today), mine = svOf(surveys, c.id), last = mine.find(x => x.answeredAt), lastSent = mine[0]
    const bits = [c.email ? 'Goes to ' + c.email : 'No email on file', last ? 'Last answered ' + dShort(last.answeredAt) + ', average ' + svFmt(svAvg(last)) : lastSent ? 'Last one sent ' + dShort(lastSent.sentAt) + ', not answered' : 'Their first survey']
    return (
      <div className="probcard rqcard" key={c.id} data-sv={c.id}>
        <div className="probhead"><span className="rqwho"><span className="rqclient">{c.name}</span><span className="rqtitle">{b >= today ? 'Due today' : 'Due since ' + dShort(b)}</span></span><span className="tag warn">To send</span></div>
        <div className="probmeta">{bits.join(' · ')}</div>
        {!c.email && <p className="rqline">Add their email on the client page, then send it from here.</p>}
        <div className="sheetbtns">
          {!!c.email && <button type="button" className="btn call" disabled={busy === 's' + c.id} onClick={() => run('s' + c.id, () => sendSurvey(c.id))}>{busy === 's' + c.id ? 'Sending…' : 'Send survey'}</button>}
          {preview(c.id, 'due')}
          <button type="button" className="btn log" disabled={busy === 'z' + c.id} onClick={() => run('z' + c.id, () => snoozeSurvey(c.id))}>Remind me in 2 weeks</button>
          {clientLink(c.id)}
        </div>
      </div>
    )
  }) : []

  // ── Answers ──
  const rowsA = f === 'answers' ? answered.filter(x => match(x.client)).sort((a, b) => (svFlag(b) ? 1 : 0) - (svFlag(a) ? 1 : 0) || b.answeredAt!.localeCompare(a.answeredAt!) || b.id.localeCompare(a.id)).map(x => {
    const c = byId.get(x.clientId), a = svAvg(x), fl = svFlag(x)
    const pv = svOf(surveys, x.clientId).filter(y => y.answeredAt && y.id !== x.id && (y.answeredAt < x.answeredAt! || (y.answeredAt === x.answeredAt && y.id < x.id))).sort((m, n) => n.answeredAt!.localeCompare(m.answeredAt!))[0]
    const bits = ['Answered ' + rqAge(x.answeredAt!, today) + ' (' + dShort(x.answeredAt) + ')']
    if (pv) { const d = Math.round((a - svAvg(pv)) * 10) / 10; bits.push(d === 0 ? 'Same as ' + dShort(pv.answeredAt) : (d > 0 ? 'Up ' : 'Down ') + svFmt(Math.abs(d)) + ' since ' + dShort(pv.answeredAt)) }
    const lows = SV_Q.filter(k => (+x.scores![k.k] || 0) <= 6).map(k => k.label.toLowerCase())
    const tag = fl ? ['Follow up', 'tag warn'] : x.followedAt ? ['Followed up', 'tag wt'] : a >= 8.5 ? ['Happy', 'tag wt'] : a >= 7 ? ['OK', 'tag sent'] : ['Unhappy', 'tag expiring']
    const following = follow === x.id
    return (
      <div className={'probcard svcard' + (fl ? '' : ' fixed')} key={x.id} data-sv={x.id}>
        <div className="probhead"><span className="rqwho"><span className="rqclient">{x.client}</span><span className="rqtitle">Average {svFmt(a)} out of 10</span></span><span className={tag[1]}>{tag[0]}</span></div>
        <div className="probmeta">{bits.join(' · ')}</div>
        <ul className="svscores">
          {SV_Q.map(k => { const v = +x.scores![k.k] || 0; return <li key={k.k} className={svCls(v)} aria-label={`${k.label}: ${v} out of 10`}><span>{k.label}</span><strong>{v}</strong></li> })}
        </ul>
        {!!x.notes && <p className="probtext">“{x.notes}”</p>}
        {fl && <p className="rqline svflag">Scored 6 or under for {lows.join(' and ')}. Get in touch, then mark it followed up so it’s off your list.</p>}
        {!!x.followedAt && <p className="rqline">You followed up {x.followedAt === today ? 'today' : dShort(x.followedAt)}: “{x.followNote}”</p>}
        {following ? (
          <div role="form" className="rqform" aria-label="Mark followed up">
            <label className="fld"><span>What did you do? <span className="req" aria-hidden="true">*</span></span>
              <textarea rows={3} autoFocus maxLength={1000} placeholder="e.g. Called Jodie, fixed the toddler room bin run with Angela." value={text} onChange={e => { setText(e.target.value); setErr('') }} />
            </label>
            <p className="cpnote">Only for you. It’s saved here and in their client history, not sent to the client.</p>
            {err && <p className="ferr" role="alert">{err}</p>}
            <div className="sheetbtns">
              <button type="button" className="btn call" disabled={busy === 'fu' + x.id} onClick={() => run('fu' + x.id, () => followUpSurvey(x.id, text), () => { setFollow(null); setText('') })}>{busy === 'fu' + x.id ? 'Saving…' : 'Mark followed up'}</button>
              <button type="button" className="btn log" onClick={() => { setFollow(null); setText(''); setErr('') }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="sheetbtns">
            {fl && <button type="button" className="btn call" onClick={() => { setFollow(x.id); setText(''); setErr('') }}>Mark followed up</button>}
            {!!x.followedAt && x.followedAt === today && <button type="button" className="btn log" disabled={busy === 'u' + x.id} onClick={() => run('u' + x.id, () => undoFollowUp(x.id))}>Undo follow up</button>}
            {!!c?.email && <a className="btn log" href={'mailto:' + c.email + '?subject=' + encodeURIComponent('Your Core Cleaning survey')}>Email them</a>}
            {!!c && clientLink(c.id)}
          </div>
        )}
      </div>
    )
  }) : []

  // ── Waiting ──
  const rowsW = f === 'waiting' ? waiting.filter(x => match(x.client)).map(x => {
    const c = byId.get(x.clientId), n = days(x.sentAt, today)
    const to = x.sentTo || c?.email || ''
    return (
      <div className="probcard rqcard going" key={x.id} data-sv={x.id}>
        <div className="probhead"><span className="rqwho"><span className="rqclient">{x.client}</span><span className="rqtitle">Waiting for their answers</span></span><span className={n >= 7 ? 'tag expiring' : 'tag sent'}>{n >= 7 ? 'No answer yet' : 'Sent'}</span></div>
        <div className="probmeta">Sent {rqAge(x.sentAt, today)} ({dShort(x.sentAt)}){to ? ' to ' + to : ''}</div>
        {!!x.remindedAt && <p className="rqline">Reminder sent {x.remindedAt === today ? 'today' : dShort(x.remindedAt)}.</p>}
        <div className="sheetbtns">
          {!x.remindedAt && !!c?.email && <button type="button" className="btn call" disabled={busy === 'r' + x.id} onClick={() => run('r' + x.id, () => remindSurvey(x.id))}>{busy === 'r' + x.id ? 'Sending…' : 'Send a reminder'}</button>}
          <button type="button" className="btn log" disabled={busy === 'c' + x.id} onClick={async () => {
            setBusy('c' + x.id)
            try { const r = await surveyLink(x.id); setToast(r.ok ? await copy(r.url, 'Survey link copied. Paste it into a text or email to ' + x.client + '.') : r.error) } catch { setToast(NO_DB) } finally { setBusy(null) }
          }}>Copy survey link</button>
          {preview(x.clientId, 'waiting', x.id)}
          {!!c && clientLink(c.id)}
        </div>
      </div>
    )
  }) : []

  // ── Schedule ──
  const rowsS = f === 'schedule' ? comm.filter(c => match(c.name)).map(c => {
    const cs = svStatus(c, today), nx = svNext(c, surveys, today), w = svWaitOf(surveys, c.id), last = svOf(surveys, c.id).find(x => x.answeredAt), isDue = svDue(c, surveys, today)
    const bits = [c.email ? 'Goes to ' + c.email : 'No email on file', last ? 'Last answered ' + dShort(last.answeredAt) + ', average ' + svFmt(svAvg(last)) : 'No answers yet']
    const title = c.off ? 'Surveys turned off' : w ? 'Survey sent ' + dShort(w.sentAt) + ', waiting for answers' : isDue ? 'Due now, ready for you to send'
      : !nx ? 'First survey due 2 months after their first clean' : (svOf(surveys, c.id).length ? 'Next survey due ' : 'First survey due ') + dLong(nx)
    const tag = c.off ? ['Off', 'tag draft'] : w ? ['Waiting', 'tag sent'] : cs === 'paused' ? ['Paused', 'tag expiring'] : isDue ? ['Due', 'tag warn'] : ['On', 'tag wt']
    const canSend = !c.off && !w && cs !== 'paused' && !!c.email
    return (
      <div className={'probcard rqcard' + (c.off ? ' fixed' : ' going')} key={c.id} data-sv={c.id}>
        <div className="probhead"><span className="rqwho"><span className="rqclient">{c.name}</span><span className="rqtitle">{title}</span></span><span className={tag[1]}>{tag[0]}</span></div>
        <div className="probmeta">{bits.join(' · ')}</div>
        {(cs === 'paused' || !c.email) && <p className="rqline">{!c.email ? 'Add their email on the client page or surveys can’t be sent.' : 'They’re paused. Surveys wait until their cleans start again.'}</p>}
        <div className="sheetbtns">
          {canSend && <button type="button" className="btn call" disabled={busy === 's' + c.id} onClick={() => run('s' + c.id, () => sendSurvey(c.id))}>{busy === 's' + c.id ? 'Sending…' : 'Send survey'}</button>}
          {preview(c.id, 'schedule')}
          {c.off
            ? <button type="button" className="btn log" disabled={busy === 'o' + c.id} onClick={() => run('o' + c.id, () => setSurveysOff(c.id, false))}>Turn on</button>
            : <button type="button" className="btn log" disabled={busy === 'o' + c.id} onClick={() => run('o' + c.id, () => setSurveysOff(c.id, true))}>Turn off</button>}
          {clientLink(c.id)}
        </div>
      </div>
    )
  }) : []

  const rows = f === 'due' ? rowsD : f === 'answers' ? rowsA : f === 'waiting' ? rowsW : rowsS
  const empty = qq ? `Nothing matches "${q.trim()}".` : f === 'due' ? 'Nothing to send. Each client comes up here every 2 months.' : f === 'answers' ? 'No answers yet. They show here as soon as a client sends theirs.' : f === 'waiting' ? 'Nobody is waiting on a survey. All answered.' : 'No active commercial clients yet.'
  const chips: [SvF, string, number][] = [
    ['due', 'To send', due.filter(c => match(c.name)).length], ['answers', 'Answers', answered.filter(x => match(x.client)).length],
    ['waiting', 'Waiting', waiting.filter(x => match(x.client)).length], ['schedule', 'Schedule', comm.filter(c => match(c.name)).length],
  ]
  return (
    <>
      <p className="sub rqsub"><span>Commercial clients only. Every 2 months each client comes up under To send, and nothing goes out until you press Send survey. It takes them about 2 minutes: five 1 to 10 ratings and a notes box. A score of 6 or under goes on your follow up list.</span></p>
      <div className="cpstats svstats">
        <div><span>Average, last 12 months</span><strong>{year.length ? svFmt(overall) + ' / 10' : 'No answers yet'}</strong></div>
        <div><span>Weakest area</span><strong>{weak ? weak.label + ' ' + svFmt(weak.avg) : '—'}</strong></div>
        <div><span>Answered</span><strong>{sentYear.length ? Math.round((sentYear.filter(x => x.answeredAt).length / sentYear.length) * 100) + '%' : '—'}</strong></div>
        <div><span>To follow up</span><strong>{flagged}</strong></div>
      </div>
      <div className="toolbar">
        <label className="search">
          <SearchIcon />
          <span className="sr">Search surveys by client</span>
          <input type="search" placeholder="Search by client" value={q} onChange={e => { setQ(e.target.value); setFollow(null); setErr('') }} />
        </label>
      </div>
      <div className="chips" role="group" aria-label="Show surveys">
        {chips.map(([id, label, n]) => (
          <button key={id} type="button" className={f === id ? 'chip on' : 'chip'} aria-pressed={f === id} onClick={() => pick(id)}>{label} <span className="n">{n}</span></button>
        ))}
      </div>
      <div className="problist">
        {f === 'due' && !qq && dueReady.length >= 2 && (
          <div className="svall"><button type="button" className="btn call" disabled={busy === 'all'} onClick={() => run('all', () => sendAllSurveys())}>{busy === 'all' ? 'Sending…' : 'Send all ' + dueReady.length}</button></div>
        )}
        {rows}
        {rows.length === 0 && <div className="empty">{empty}</div>}
      </div>
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button type="button" className="undo" onClick={() => setToast('')} aria-label="Dismiss">OK</button>
        </div>
      )}
    </>
  )
}
