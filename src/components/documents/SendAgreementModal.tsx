'use client'

import { useState } from 'react'
import { X, PenLine, Loader2, Check, Copy } from 'lucide-react'
import { sendForSignatureAction } from '@/actions/signing'

// Sends the agreement for signature via a unique, secure link (/sign/<token>).
// The client reads it, types their name and confirms — the doc then marks Signed
// automatically and the owner is notified.
export function SendAgreementModal({ id, onClose }: { id: string; status?: string; onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function send() {
    setBusy(true); setError(null)
    const res = await sendForSignatureAction(id, email.trim(), message.trim() || undefined)
    setBusy(false)
    if (res?.error) { setError(res.error); return }
    setLink(res?.link ?? null)
    setSent(true)
  }

  function copy() {
    if (!link) return
    navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800) }).catch(() => {})
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded-2xl border border-gray-200 shadow-xl p-6 max-h-[92dvh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <h3 className="font-display text-lg font-bold text-gray-900">Send agreement to sign</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>

        {sent ? (
          <div className="py-4 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-3"><Check className="w-6 h-6 text-emerald-600" /></div>
            <p className="text-sm font-semibold text-gray-900">Agreement sent</p>
            <p className="text-xs text-gray-400 mt-1 mb-4">The client got a secure link to review and sign. It marks <span className="font-medium text-gray-500">Signed</span> automatically once they do — and you&apos;ll get a notification.</p>
            {link && (
              <button onClick={copy} className="inline-flex items-center gap-2 text-xs font-semibold bg-gray-50 border border-gray-200 text-gray-700 hover:border-gray-300 rounded-lg px-3 py-2">
                {copied ? <><Check className="w-3.5 h-3.5 text-emerald-600" /> Link copied</> : <><Copy className="w-3.5 h-3.5" /> Copy the signing link</>}
              </button>
            )}
            <button onClick={onClose} className="block w-full mt-4 text-sm font-semibold text-gray-500 hover:text-gray-700">Done</button>
          </div>
        ) : (
          <>
            <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-2.5 mb-4">
              <p className="text-xs text-blue-700">This emails the client a unique, branded link to read and e-sign the agreement online — no DocuSign, no account needed.</p>
            </div>
            <div className="space-y-3.5">
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Send to</label>
                <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="client@company.com.au"
                  className="w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-lg px-3 py-2.5 text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Personal note (optional)</label>
                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} placeholder="Add a short message to the client…"
                  className="w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-lg px-3 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none" />
              </div>
            </div>
            {error && <div className="mt-3 rounded-xl bg-red-50 border border-red-100 px-3 py-2.5 text-sm text-red-600">{error}</div>}
            <button onClick={send} disabled={busy || !email.trim()}
              className="w-full mt-4 inline-flex items-center justify-center gap-2 bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-sm font-semibold rounded-xl py-3.5 disabled:opacity-40 active:scale-[0.99] transition-all">
              {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : <><PenLine className="w-4 h-4" /> Send for signature</>}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
