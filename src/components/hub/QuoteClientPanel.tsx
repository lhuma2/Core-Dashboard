'use client'

import { useState, useTransition } from 'react'
import { clientAccept, clientAskChanges, clientDecline } from '@/actions/hub-quotes'
import { DECLINE_REASONS } from '@/lib/hub/home-quotes'

type Acc = { street: string; suburb: string; postcode: string; start: string }

// The client's page around the quote: a status line on top, the quote, then (while it's open) confirm the address
// and date and accept, ask for changes, or decline. After they answer, their thank-you stays on top even when the
// page refreshes with the new status.
export function QuoteClientPanel({ code, open, closedText, oneOff, minDate, initial, children }: { code: string; open: boolean; closedText: string; oneOff: boolean; minDate: string; initial: Acc; children: React.ReactNode }) {
  const [a, setA] = useState<Acc>(initial)
  const [mode, setMode] = useState<null | 'changes' | 'decline'>(null)
  const [note, setNote] = useState('')
  const [reason, setReason] = useState('')
  const [err, setErr] = useState('')
  const [done, setDone] = useState('')
  const [busy, start] = useTransition()
  const upd = (k: keyof Acc, v: string) => { setA({ ...a, [k]: v }); setErr('') }
  const run = (p: Promise<{ ok: true; message: string } | { ok: false; error: string }>) => start(async () => {
    const r = await p
    if (!r.ok) { setErr(r.error); return }
    setDone(r.message); window.scrollTo({ top: 0, behavior: 'smooth' })
  })

  const banner = done || closedText
  return (
    <>
      {banner && <p className={done ? 'agstatus ok asbanner' : 'agstatus asbanner'} role="status">{banner}</p>}
      {children}
      {open && !done && <div className="addcard pacc">
      <h2 className="nch">Happy to go ahead?</h2>
      <p className="nchint">Confirm the address and the date, then press Accept. We’ll confirm the time and email your service agreement to sign.</p>
      <div className="ncgrid">
        <label className="fld span2"><span>Street address</span><input type="text" autoComplete="street-address" value={a.street} onChange={e => upd('street', e.target.value)} /></label>
        <label className="fld subf"><span>Suburb</span><input type="text" value={a.suburb} onChange={e => upd('suburb', e.target.value)} /></label>
        <label className="fld pc"><span>Postcode</span><input type="text" inputMode="numeric" maxLength={4} value={a.postcode} onChange={e => upd('postcode', e.target.value.replace(/\D/g, '').slice(0, 4))} /></label>
        <label className="fld half"><span>{oneOff ? 'Clean date' : 'First clean date'}</span><input type="date" min={minDate} value={a.start} onChange={e => upd('start', e.target.value)} /></label>
      </div>
      {err && <p className="ferr" role="alert">{err}</p>}
      <div className="sheetbtns">
        <button type="button" className="btn call" disabled={busy} onClick={() => run(clientAccept(code, a))}>{busy && !mode ? 'Accepting…' : 'Accept quote'}</button>
        <button type="button" className={mode === 'changes' ? 'btn log pcon' : 'btn log'} aria-pressed={mode === 'changes'} onClick={() => { setMode(mode === 'changes' ? null : 'changes'); setErr('') }}>Ask for changes</button>
        <button type="button" className={mode === 'decline' ? 'btn log pcon' : 'btn log'} aria-pressed={mode === 'decline'} onClick={() => { setMode(mode === 'decline' ? null : 'decline'); setErr('') }}>Decline</button>
      </div>
      {mode === 'changes' && (
        <div className="sendbox">
          <label className="fld"><span>What would you like changed?</span><textarea rows={3} placeholder="e.g. Could you add the oven to the regular clean?" value={note} onChange={e => { setNote(e.target.value); setErr('') }} /></label>
          <div className="sheetbtns"><button type="button" className="btn call" disabled={busy} onClick={() => run(clientAskChanges(code, note))}>Send request</button><button type="button" className="btn log" onClick={() => { setMode(null); setErr('') }}>Cancel</button></div>
        </div>
      )}
      {mode === 'decline' && (
        <div className="sendbox">
          <div className="fld" role="radiogroup" aria-label="Reason for declining"><span>Main reason</span>
            {DECLINE_REASONS.map(r => <label className="check" key={r}><input type="radio" name="qreason" checked={reason === r} onChange={() => { setReason(r); setErr('') }} /><span>{r}</span></label>)}
          </div>
          <label className="fld"><span>Notes (optional)</span><textarea rows={2} value={note} onChange={e => { setNote(e.target.value); setErr('') }} /></label>
          <div className="sheetbtns"><button type="button" className="btn log dangerbtn" disabled={busy} onClick={() => run(clientDecline(code, reason, note))}>Decline quote</button><button type="button" className="btn log" onClick={() => { setMode(null); setErr('') }}>Cancel</button></div>
        </div>
      )}
    </div>}
    </>
  )
}
