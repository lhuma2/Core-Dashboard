'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { clientAcceptProposal, clientDeclineProposal, clientReviseProposal } from '@/actions/hub-proposals'
import { DECLINE_WHY } from '@/lib/hub/proposals'

/** "Happy to go ahead?" under the client's proposal: accept, ask for a revised quote, or decline. Words from the mock-up. */
export function ProposalClientPanel({ code, hint, needsDate, minDate, closed = null }: { code: string; hint: string; needsDate: boolean; minDate: string; closed?: ReactNode }) {
  const router = useRouter()
  const [mode, setMode] = useState<null | 'revise' | 'decline'>(null)
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [reason, setReason] = useState('')
  const [err, setErr] = useState('')
  const [modeErr, setModeErr] = useState('')
  const [done, setDone] = useState('')
  const [busy, start] = useTransition()
  const OFFLINE = 'That didn’t go through. Check your connection and try again.'

  // the thank-you stays put when the page refreshes underneath it (the same panel is rendered in every state)
  if (done) return <div className="addcard pacc pubdone" role="status"><h2 className="nch">Thank you</h2><p className="nchint">{done}</p></div>
  if (closed) return <div className="pacc">{closed}</div>

  function pick(m: 'revise' | 'decline') { if (mode !== m) { setMode(m); setNote(''); setReason(''); setErr(''); setModeErr('') } }
  return (
    <div className="addcard pacc">
      <h2 className="nch">Happy to go ahead?</h2>
      <p className="nchint">{hint}</p>
      <div className="stackform">
        {needsDate && <label className="fld"><span>When would you like the works done?</span><input type="date" min={minDate} value={date} onChange={e => { setDate(e.target.value); setErr('') }} /></label>}
        {err && <p className="ferr" role="alert">{err}</p>}
        <div className="sheetbtns">
          <button type="button" className="btn call" disabled={busy} onClick={() => {
            if (needsDate && !/^\d{4}-\d{2}-\d{2}$/.test(date)) { setErr('Choose the day you’d like the works done.'); return }
            start(async () => {
              try {
                const r = await clientAcceptProposal(code, date)
                if (!r.ok) { setErr(r.error); return }
                if (r.next) router.push(r.next); else setDone(r.message)
              } catch { setErr(OFFLINE) }
            })
          }}>{busy && !mode ? 'One moment…' : 'Accept proposal'}</button>
          <button type="button" className={mode === 'revise' ? 'btn log pcon' : 'btn log'} aria-expanded={mode === 'revise'} onClick={() => pick('revise')}>Request a revised quote</button>
          <button type="button" className={mode === 'decline' ? 'btn log pcon' : 'btn log'} aria-expanded={mode === 'decline'} onClick={() => pick('decline')}>Decline</button>
        </div>
        {mode === 'revise' && (
          <div className="sendbox">
            <label className="fld"><span>What would you like changed?</span><textarea rows={3} placeholder="e.g. Could you quote 2 cleans a week instead of 3?" value={note} onChange={e => { setNote(e.target.value); setModeErr('') }} /></label>
            {modeErr && <p className="ferr" role="alert">{modeErr}</p>}
            <div className="sheetbtns">
              <button type="button" className="btn call" disabled={busy} onClick={() => {
                if (note.trim().length < 3) { setModeErr('Tell us what you’d like changed.'); return }
                start(async () => { try { const r = await clientReviseProposal(code, note); if (!r.ok) setModeErr(r.error); else setDone(r.message) } catch { setModeErr(OFFLINE) } })
              }}>Send request</button>
              <button type="button" className="btn log" onClick={() => { setMode(null); setModeErr('') }}>Cancel</button>
            </div>
          </div>
        )}
        {mode === 'decline' && (
          <div className="sendbox">
            <div className="fld" role="radiogroup" aria-label="Reason for declining"><span>Main reason</span>
              {DECLINE_WHY.map(lab => (
                <label className="check" key={lab}><input type="radio" name="pcreason" checked={reason === lab} onChange={() => { setReason(lab); setModeErr('') }} /><span>{lab}</span></label>
              ))}
            </div>
            <label className="fld"><span>Notes (optional)</span><textarea rows={2} value={note} onChange={e => setNote(e.target.value)} /></label>
            {modeErr && <p className="ferr" role="alert">{modeErr}</p>}
            <div className="sheetbtns">
              <button type="button" className="btn log dangerbtn" disabled={busy} onClick={() => {
                if (!reason) { setModeErr('Choose the main reason.'); return }
                start(async () => { try { const r = await clientDeclineProposal(code, reason, note); if (!r.ok) setModeErr(r.error); else setDone(r.message) } catch { setModeErr(OFFLINE) } })
              }}>Decline proposal</button>
              <button type="button" className="btn log" onClick={() => { setMode(null); setModeErr('') }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
