'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { sendAgreement, resendAgreement, deleteAgreement } from '@/actions/hub-agreements'
import { setFlash, takeFlash } from '@/lib/hub/flash'
import { copyLink } from './DocList'
import type { DocStatus } from '@/lib/hub/home-agreements'
import { useDiv } from '@/lib/hub/use-div'

// On the agreement view: send a draft for signature, or resend / copy link / client view / withdraw, and Download PDF.
export function AgreementAdminBar({ id, ref_, code, status, email, client, draftNote }: { id: string; ref_: string; code: string; status: DocStatus; email: string; client: string; draftNote: string }) {
  const { base, div, name: divName, lower: divLower } = useDiv()
  const router = useRouter()
  const [sending, setSending] = useState(false)
  const [to, setTo] = useState(email)
  const [err, setErr] = useState('')
  const [toast, setToast] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, start] = useTransition()
  useEffect(() => { const m = takeFlash(); if (m) setToast(m) }, [])
  return (
    <>
      {status === 'draft' && <>
        <p className="dp">{draftNote}</p>
        {sending ? (
          <div className="sendbox">
            <label className="fld"><span>Send the signing link to</span><input type="email" autoComplete="off" autoCapitalize="off" value={to} onChange={e => { setTo(e.target.value); setErr('') }} /></label>
            {err && <p className="ferr" role="alert">{err}</p>}
            <div className="sheetbtns">
              <button type="button" className="btn call" disabled={busy} onClick={() => start(async () => {
                const r = await sendAgreement(id, to.trim())
                if (!r.ok) { setErr(r.error); return }
                setSending(false); setToast(r.toast); router.refresh()
              })}>{busy ? 'Sending…' : 'Send from admin@'}</button>
              <button type="button" className="btn log" onClick={() => { setSending(false); setErr('') }}>Cancel</button>
            </div>
          </div>
        ) : <div className="sheetbtns"><button type="button" className="btn call" onClick={() => { setSending(true); setTo(email); setErr('') }}>Send for signature</button></div>}
      </>}
      <div className="sheetbtns">
        {status === 'sent' && <>
          <a className="btn log" href={`/agree/${code}`} target="_blank" rel="noreferrer">See what the client sees</a>
          <button type="button" className="btn log" disabled={busy} onClick={() => start(async () => { const r = await resendAgreement(id); setToast(r.ok ? r.toast : r.error) })}>Resend</button>
          <button type="button" className="btn log" onClick={() => copyLink(code, setToast)}>Copy signing link</button>
        </>}
        <button type="button" className="btn log" onClick={() => window.print()}>Download PDF</button>
        {status !== 'signed' && <button type="button" className="btn log dangerbtn" onClick={() => setConfirming(true)}>{status === 'sent' ? 'Withdraw' : 'Delete'}</button>}
      </div>
      {confirming && (
        <div className="inlineconfirm">
          <span>{status === 'sent' ? `Withdraw ${ref_}? The signing link stops working.` : `Remove ${ref_} for good?`}</span>
          <button type="button" className="btn call dangerfill" disabled={busy} onClick={() => start(async () => {
            const r = await deleteAgreement(id)
            if (!r.ok) { setToast(r.error); setConfirming(false); return }
            setFlash(r.toast); router.push(base + '/documents'); router.refresh()
          })}>{status === 'sent' ? 'Yes, withdraw' : 'Yes, delete'}</button>
          <button type="button" className="btn log" onClick={() => setConfirming(false)}>Keep it</button>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button type="button" className="undo" onClick={() => setToast('')} aria-label="Dismiss">OK</button>
        </div>
      )}
    </>
  )
}
