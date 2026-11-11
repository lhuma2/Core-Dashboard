'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { sendQuote } from '@/actions/hub-quotes'
import { setFlash } from '@/lib/hub/flash'
import type { QStatus } from '@/lib/hub/home-quotes'

// Above the quote preview: where it's up to, and Edit / Send / client view / PDF.
export function QuoteAdminBar({ id, code, status, email, statusText, statusCls }: { id: string; code: string; status: QStatus; email: string; statusText: string; statusCls: string }) {
  const router = useRouter()
  const [err, setErr] = useState('')
  const [busy, start] = useTransition()
  const canEdit = status === 'draft' || status === 'changes' || status === 'sent'
  const canSend = status === 'draft' || status === 'changes'
  return (
    <div className="pdbar">
      <p className={statusCls}>{statusText}</p>
      <div className="sheetbtns">
        {canEdit && <Link className="btn log" href={`/hub/residential/quotes/${id}/edit?from=view`}>Edit</Link>}
        {canSend && (
          <button type="button" className="btn call" disabled={busy} onClick={() => start(async () => {
            const r = await sendQuote(id, email)
            if (!r.ok) { setErr(r.error); return }
            setFlash(r.toast)
            router.push('/hub/residential/quotes?show=sent')
            router.refresh()
          })}>{busy ? 'Sending…' : 'Send to client'}</button>
        )}
        {status === 'sent' && <a className="btn log" href={`/q/${code}`} target="_blank" rel="noreferrer">See what the client sees</a>}
        <button type="button" className="btn log" onClick={() => window.print()}>Download PDF</button>
      </div>
      {err && <p className="ferr" role="alert">{err}</p>}
    </div>
  )
}
