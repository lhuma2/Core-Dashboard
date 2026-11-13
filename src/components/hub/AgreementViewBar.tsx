'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { resendPortalWelcome } from '@/actions/hub-comm-agreements'

/** The viewer's action buttons that need the browser: Download PDF (print) and Send the welcome email again. */
export function AgreementViewBar({ id, signedCode, portal }: { id: string; signedCode: string | null; portal: boolean }) {
  const router = useRouter()
  const [toast, setToast] = useState('')
  const [busy, start] = useTransition()
  return (
    <>
      <div className="sheetbtns noprint">
        {signedCode && <a className="btn log" href={`/agreement/${signedCode}?print=1`} target="_blank" rel="noreferrer">Download PDF</a>}
        {portal && <button type="button" className="btn log" disabled={busy} onClick={() => start(async () => {
          try { const r = await resendPortalWelcome(id); setToast(r.ok ? r.toast : r.error); if (r.ok) router.refresh() } catch { setToast('Couldn’t reach the hub. Check your connection and try again.') }
        })}>Send the welcome email again</button>}
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
