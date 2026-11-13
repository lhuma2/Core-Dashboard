'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { finishClean, reportProblem, saveTicks, startClean } from '@/actions/crew'
import { ADDON_FREQ, cap, dateLabel, MAXPH, t12, tickCount, type CrewJob } from '@/lib/crew/jobs'
import { addPhotos, kick, removePhoto } from '@/lib/crew/photo-queue'
import { usePhotos } from './usePhotos'

const Tick = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg>
const clock = (ts: string | null) => (ts ? new Intl.DateTimeFormat('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Australia/Brisbane' }).format(new Date(ts)).replace(/\s/g, ' ').toLowerCase() : '')
const LS = (k: string) => 'crew-ticks:' + k
const OFFLINE = 'That didn’t save. Check your signal and try again.'

export function CrewJobView({ job, today, me, serverPhotos }: { job: CrewJob; today: string; me: string; serverPhotos: string[] }) {
  const router = useRouter()
  const [ticks, setTicks] = useState<Record<string, boolean>>(job.ticks)
  const [err, setErr] = useState('')
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState<'' | 'start' | 'finish' | 'issue' | 'photos'>('')
  const [issue, setIssue] = useState<string | null>(null)
  const { list, online } = usePhotos(today)
  const saving = useRef<Promise<unknown> | null>(null)

  const notStarted = job.status === 'booked', going = job.status === 'in_progress', finished = job.status === 'done'
  const isEol = job.kind === 'eol', minPh = job.minPh
  const flash = useCallback((m: string) => setToast(m), [])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 5000); return () => clearTimeout(t) }, [toast])
  useEffect(() => { setTicks(job.ticks) }, [job.ticks])

  // ticks survive a refresh or no signal: kept on the phone until the server has them
  const push = useCallback(async (t: Record<string, boolean>) => {
    try { localStorage.setItem(LS(job.key), JSON.stringify(t)) } catch { /* private mode */ }
    const p = saveTicks(job.key, t).then(r => {
      if (r.ok) { try { localStorage.removeItem(LS(job.key)) } catch { /* private mode */ } }
      else if (r.error !== OFFLINE) flash(r.error)
    }).catch(() => { /* no signal: kept on the phone, sent again when back online */ })
    saving.current = p
    return p
  }, [job.key, flash])
  useEffect(() => {
    if (!going) return
    let held: Record<string, boolean> | null = null
    try { const s = localStorage.getItem(LS(job.key)); if (s) held = JSON.parse(s) } catch { /* none */ }
    if (held) { setTicks(held); void push(held) }
    const again = () => { try { const s = localStorage.getItem(LS(job.key)); if (s) void push(JSON.parse(s)) } catch { /* none */ } }
    window.addEventListener('online', again)
    return () => window.removeEventListener('online', again)
  }, [going, job.key, push])

  function toggle(k: string) {
    if (notStarted) { flash('Tap Start clean first.'); return }
    if (finished) return
    const t = { ...ticks }
    if (t[k]) delete t[k]; else t[k] = true
    setTicks(t); setErr('')
    void push(t)
  }

  // photos: the ones on this phone, plus any that reached the hub from another phone
  const mine = list.filter(p => p.job === job.key)
  const extra = serverPhotos.filter(id => !mine.some(p => p.id === id)).length
  const count = mine.length + extra
  const waiting = mine.filter(p => p.state === 'wait').length
  const sentN = count - waiting
  const ack = !!ticks.ack

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target, files = input.files ? Array.from(input.files) : []
    if (!going || !files.length) { input.value = ''; return }
    setBusy('photos')
    try {
      const r = await addPhotos(job.key, job.iso, files, Math.max(0, MAXPH - count))
      setErr('')
      if (r.over) flash('That’s the most for one clean (' + MAXPH + ' photos).')
      else if (r.skipped) flash('Only photos can be added here.')
    } catch { flash('Those photos couldn’t be saved on this phone. Try again.') }
    finally { input.value = ''; setBusy('') }
  }

  async function start() {
    if (busy) return
    setBusy('start')
    try {
      const r = await startClean(job.key)
      if (!r.ok) flash(r.error)
      else router.refresh()
    } catch { flash(OFFLINE) }
    finally { setBusy('') }
  }

  async function finish() {
    if (busy) return
    if (count < minPh && !(isEol && ack)) {
      setErr((count ? 'Take ' + (minPh - count) + ' more photo' + (minPh - count === 1 ? '' : 's') + ' of the finished job first (at least ' + minPh + ').' : 'Take at least ' + minPh + ' photos of the finished job first. Tap Take or add photos.') + (isEol ? ' If they won’t upload, tick the box to confirm they’re in your phone’s library.' : ''))
      return
    }
    setBusy('finish'); setErr('')
    try {
      if (saving.current) await saving.current
      const r = await finishClean(job.key, count)
      if (!r.ok) { setErr(r.error); return }
      try { localStorage.removeItem(LS(job.key)) } catch { /* private mode */ }
      flash(r.toast + (waiting ? ' Your photos keep sending in the background. You can close the app.' : count ? ' Your photos are on the hub.' : ''))
      kick()
      router.refresh()
    } catch { setErr(OFFLINE) }
    finally { setBusy('') }
  }

  async function sendIssue() {
    const t = (issue || '').trim()
    if (t.length < 5) { flash('Describe the problem first.'); return }
    setBusy('issue')
    try {
      const r = await reportProblem(job.key, t)
      if (!r.ok) { flash(r.error); return }
      setIssue(null); flash('Sent. Laith gets an email and a phone notification.')
    } catch { flash(OFFLINE) }
    finally { setBusy('') }
  }

  const { done: doneN, total } = tickCount({ ...job, ticks })
  const others = job.team.filter(n => n !== me)
  const locked = notStarted || finished
  const phCount = finished
    ? (waiting === 0 ? count + ' photo' + (count === 1 ? '' : 's') + ' sent to the hub ✓' : sentN + ' of ' + count + ' sent. The rest are saved on this phone and send on their own' + (!online ? ' when you have signal.' : '.'))
    : count >= minPh ? count + ' photos ✓ You can add more if you like.'
      : ack ? count + ' uploaded. You ticked that all the exit photos are in your library'
        : count + ' of ' + minPh + ' photos taken'
  const phOk = finished ? waiting === 0 : count >= minPh

  return (
    <>
      <Link className="back" href="/cleaner/app">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        My jobs
      </Link>
      <div className="jobgrid">
        <div className="jhead ga-head">
          <h1 className="greet">{job.name}</h1>
          {job.address && <span className="addr">{job.address}</span>}
          {job.address && <a className="maplink" href={'https://maps.apple.com/?q=' + encodeURIComponent(job.address)} target="_blank" rel="noopener noreferrer">Open in Maps</a>}
          <div className="meta">
            <span className="chip">{job.iso === today ? 'Today' : dateLabel(job.iso)}</span>
            <span className="chip">{job.start ? t12(job.start) + (job.finish ? ' to ' + t12(job.finish) : '') : 'Any time'}</span>
            <span className="chip">{others.length ? 'With ' + others.join(', ') : 'Just you'}</span>
            {job.homeLabel && <span className="chip">{job.homeLabel}</span>}
          </div>
        </div>

        <div className="ga-access">
          <h2 className="sect">Access details</h2>
          <div className="access">{job.access || 'No access details yet. Call Laith if you can’t get in.'}<small>Only the cleaners on this job can see this.</small></div>
        </div>

        <div className="ga-scope">
          <h2 className="sect">Scope of works</h2>
          <p className="tracknote">Ticking is optional. The checklist is just there to help you keep track of what you’ve done.</p>
          {notStarted && <div className="status"><span>Tap <strong>Start clean</strong> when you arrive.</span></div>}
          {going && <>
            <div className="status" data-testid="tick-status"><span><strong>{doneN} of {total}</strong> done · started {clock(job.startedAt)}</span></div>
            <div className="prog" aria-hidden="true"><span style={{ width: (total ? Math.round(doneN / total * 100) : 0) + '%' }} /></div>
          </>}
          {finished && <div className="donecard" data-testid="done-card">Finished at {clock(job.finishedAt)}. {doneN} of {total} ticked.</div>}
          <div style={{ height: 8 }} />
          {job.addons.map(a => {
            const done = !!ticks['x:' + a.id]
            return (
              <div key={a.id} className={'sowsec addon' + (a.carried ? ' late' : '')} data-testid="addon-box">
                <h3 className="sowh">{(job.iso === today ? 'Today: ' : 'Due this clean: ') + a.name}</h3>
                <p className="xnote">{cap(ADDON_FREQ[a.freq] || a.freq) + ' add-on.' + (a.carried && a.from ? ' Carried over from ' + dateLabel(a.from) + ', so please get it done ' + (job.iso === today ? 'today.' : 'on this clean.') : ' Only shows on the clean it’s due.')}</p>
                {a.items.map((t, ti) => {
                  const on = !!ticks['x:' + a.id + '.' + ti]
                  return (
                    <button key={ti} type="button" role="checkbox" aria-checked={on} className={'task' + (on ? ' on' : '') + (locked ? ' locked' : '')} onClick={() => toggle('x:' + a.id + '.' + ti)}>
                      <span className="box" aria-hidden="true"><Tick /></span><span className="tt">{t}</span>
                    </button>
                  )
                })}
                <button type="button" className={'btn ' + (done ? 'main' : 'ghost') + ' xdone'} aria-pressed={done} onClick={() => toggle('x:' + a.id)}>{done ? a.name + ' done ✓' : 'Mark ' + a.name.toLowerCase() + ' done'}</button>
              </div>
            )
          })}
          {job.sow.map((b, bi) => (
            <div className="sowsec" key={bi}>
              <h3 className="sowh">{b.heading}</h3>
              {b.items.map((it, ii) => {
                const k = bi + '.' + ii, on = !!ticks[k]
                return (
                  <button key={ii} type="button" role="checkbox" aria-checked={on} className={'task' + (on ? ' on' : '') + (locked ? ' locked' : '')} onClick={() => toggle(k)}>
                    <span className="box" aria-hidden="true"><Tick /></span>
                    <span className="tt">{it.text}</span>
                    {it.freq && <span className={it.freq === 'Every visit' ? 'ftag' : 'ftag periodic'}>{it.freq}</span>}
                  </button>
                )
              })}
            </div>
          ))}
          {!job.sow.length && <div className="excl">No scope of works on file for this job yet. Ask Laith what’s included.</div>}
          {job.excludes && <div className="excl"><strong>Not included:</strong> {job.excludes.replace(/^Excludes /, '')}</div>}
        </div>

        <div className="actions ga-actions">
          {notStarted && <>
            <button type="button" className="btn main" onClick={start} disabled={busy === 'start'}>{busy === 'start' ? 'Starting…' : 'Start clean'}</button>
            {job.iso !== today && <p className="hint">You can start this clean on the day.</p>}
          </>}
          {!notStarted && (
            <div className="phbox" data-testid="photo-box">
              <h3>{isEol ? 'Exit photos' : 'Completion photos'}</h3>
              {isEol && going && <p className="hint"><strong>End of lease:</strong> cover every room, inside the oven, cupboards and wardrobes, the bathroom, shower, tracks and floors. The agent may compare them at the final inspection.</p>}
              {going && <p className="hint">Take at least {minPh} photos of the finished job. Each one is saved on this phone the moment you take it, so nothing is lost if the signal drops or the app closes.</p>}
              <span className={'phcount' + (phOk ? ' ok' : '')} data-testid="ph-count">{phCount}</span>
              {mine.length > 0 && (
                <div className="phgrid">
                  {mine.map((p, pi) => (
                    <div className="phcell" key={p.id} data-testid="ph-cell">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {p.thumb ? <img src={p.thumb} alt={'Completion photo ' + (pi + 1) + ' of ' + mine.length} /> : null}
                      <span className={'phst' + (p.state === 'wait' && !online ? ' wait' : '')}>{p.state === 'sent' ? 'Sent ✓' : online ? 'Sending…' : 'On phone'}</span>
                      {!finished && (
                        <button type="button" className="phrm" aria-label={'Remove photo ' + (pi + 1)} onClick={async () => { if (!(await removePhoto(p))) flash('That photo couldn’t be removed. Check your signal and try again.') }}>
                          <span aria-hidden="true">×</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {going && (
                <label className="btn ghost phadd">
                  <input className="sr" type="file" accept="image/*" multiple onChange={onPick} data-testid="ph-input" />
                  {busy === 'photos' ? 'Saving photos…' : count ? 'Add more photos' : 'Take or add photos'}
                </label>
              )}
              {isEol && going && count < minPh && (
                <button type="button" role="checkbox" className="phack" aria-checked={ack} onClick={() => toggle('ack')} data-testid="ph-ack">
                  <span className="box" aria-hidden="true"><Tick /></span>
                  <span>Having trouble uploading? Tick to confirm you’ve taken all {minPh}+ exit photos and they’re saved in your phone’s photo library. Laith is told and may ask you for them.</span>
                </button>
              )}
              {isEol && finished && ack && <p className="hint">You confirmed the exit photos are in your phone’s library. Keep them until Laith says they’re not needed.</p>}
            </div>
          )}
          {going && <>
            {err && <p className="ferr" role="alert">{err}</p>}
            <button type="button" className="btn main" onClick={finish} disabled={busy === 'finish'}>{busy === 'finish' ? 'Finishing…' : 'Finish clean'}</button>
          </>}
          {issue !== null ? <>
            <label className="fld"><span>What’s the problem?</span><textarea value={issue} onChange={e => setIssue(e.target.value)} placeholder="e.g. Toilet in bathroom 2 is blocked" maxLength={2000} /></label>
            <button type="button" className="btn ghost" onClick={sendIssue} disabled={busy === 'issue'}>{busy === 'issue' ? 'Sending…' : 'Send to Laith'}</button>
            <button type="button" className="linkbtn" onClick={() => setIssue(null)}>Cancel</button>
          </> : (
            <button type="button" className="btn warn" onClick={() => setIssue('')}>Report a problem</button>
          )}
        </div>
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  )
}
