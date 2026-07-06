'use client'

import { useState } from 'react'
import { X, Loader2, Send, Check } from 'lucide-react'
import { sendCompanyDocForSignatureAction } from '@/actions/signing'

export function SendCompanyDocModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function send() {
    setErr(null); setBusy(true)
    const res = await sendCompanyDocForSignatureAction(id, email, message || undefined)
    setBusy(false)
    if (res?.error) { setErr(res.error); return }
    setDone(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Send for signature</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
        </div>

        {done ? (
          <div className="p-6 text-center">
            <div className="w-11 h-11 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
              <Check className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-sm font-semibold text-gray-900">Sent to {email}</p>
            <p className="text-xs text-gray-500 mt-1">They'll get an email with a link to review and sign the document.</p>
            <button onClick={onClose} className="mt-5 inline-flex items-center gap-1.5 bg-[#003314] hover:bg-[#00250e] text-white text-sm font-semibold rounded-lg px-4 py-2">Done</button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Recipient email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value.trim())} placeholder="client@example.com"
                className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00250e]/25 focus:border-[#00250e]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Message (optional)</label>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="Add a short note…"
                className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00250e]/25 focus:border-[#00250e]" />
            </div>
            {err && <p className="text-xs text-red-500">{err}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={onClose} className="text-sm font-semibold text-gray-500 hover:text-gray-700 px-3 py-2">Cancel</button>
              <button onClick={send} disabled={busy || !email}
                className="inline-flex items-center gap-1.5 bg-[#003314] hover:bg-[#00250e] text-white text-sm font-semibold rounded-lg px-4 py-2 disabled:opacity-50">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
