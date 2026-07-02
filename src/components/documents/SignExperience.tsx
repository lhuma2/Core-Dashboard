'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Check, ShieldCheck, PenLine, Download, Lock } from 'lucide-react'
import { AgreementDocument, type SignatureFill } from '@/components/documents/render/AgreementDocument'
import type { AgreementData } from '@/lib/documents/agreement'
import { submitSignatureAction } from '@/actions/signing'

const WORDMARK_WHITE = '/proposal-assets/wordmark-white.png'

export function SignExperience({
  token, data, alreadySigned,
}: {
  token: string
  data: AgreementData
  alreadySigned: SignatureFill | null
}) {
  const [signed, setSigned] = useState<SignatureFill | null>(alreadySigned)
  const [name, setName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const today = useMemo(
    () => new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }),
    [],
  )
  const hasName = name.trim().length >= 2

  // ── Fit the 794px document to the viewport width (scaled + clipped) ──
  const wrapRef = useRef<HTMLDivElement>(null)
  const docRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.5)
  const [boxH, setBoxH] = useState(0)

  const fit = useCallback(() => {
    const cw = wrapRef.current?.clientWidth ?? 380
    const s = Math.min(1, cw / 794)
    setScale(s)
    const dh = docRef.current?.scrollHeight ?? 0
    if (dh) setBoxH(dh * s)
  }, [])

  useEffect(() => {
    fit()
    const t = setTimeout(fit, 120)   // re-measure after fonts/images settle
    window.addEventListener('resize', fit)
    return () => { clearTimeout(t); window.removeEventListener('resize', fit) }
  }, [fit, signed])

  async function sign() {
    if (!hasName || !agreed || busy) return
    setBusy(true); setError(null)
    const res = await submitSignatureAction(token, name)
    setBusy(false)
    if (res?.error) { setError(res.error); return }
    setSigned({ name: name.trim().replace(/\s+/g, ' '), date: res?.date ?? today })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="min-h-[100dvh] bg-[#0b1320]">
      {/* ── Header ── */}
      <header className="px-5 pt-8 pb-6 text-center">
        <img src={WORDMARK_WHITE} alt="Delta Cleaning" className="h-6 w-auto mx-auto mb-5 opacity-95" />
        {signed ? (
          <>
            <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center mx-auto mb-4">
              <Check className="w-7 h-7 text-emerald-400" />
            </div>
            <h1 className="text-white text-2xl font-bold tracking-tight">You&apos;re all set, {signed.name.split(' ')[0]}.</h1>
            <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto">
              Your service agreement with Delta Cleaning is signed and saved. A copy is below — keep it for your records.
            </p>
            <a
              href={`/sign/${token}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 mt-5 bg-white text-[#0b1320] text-sm font-bold rounded-xl px-5 py-3 active:scale-[0.98] transition-transform"
            >
              <Download className="w-4 h-4" /> Save a copy (PDF)
            </a>
          </>
        ) : (
          <>
            <p className="text-[11px] font-bold tracking-[0.16em] uppercase text-blue-300 mb-2">Service Agreement</p>
            <h1 className="text-white text-2xl font-bold tracking-tight max-w-md mx-auto">
              {data.clientName}, you&apos;re ready to sign.
            </h1>
            <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto">
              Take a moment to read your agreement below. When you&apos;re happy, sign at the bottom — it takes about a minute.
            </p>
            <div className="inline-flex items-center gap-1.5 mt-4 text-[11px] text-slate-500">
              <Lock className="w-3 h-3" /> Secure · unique to you · no account needed
            </div>
          </>
        )}
      </header>

      {/* ── Document ── */}
      <div className="bg-[#E6E8EB] px-3 py-6">
        <div ref={wrapRef} className="mx-auto max-w-[820px]">
          <div style={{ height: boxH || undefined, overflow: 'hidden' }}>
            <div ref={docRef} style={{ width: 794, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
              <AgreementDocument data={data} signature={signed} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Sign panel (only before signing) ── */}
      {!signed && (
        <div className="sticky bottom-0 bg-white border-t border-gray-200 shadow-[0_-8px_30px_rgba(0,0,0,0.12)]">
          <div className="max-w-[560px] mx-auto px-5 py-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <PenLine className="w-3.5 h-3.5" /> Sign here
            </p>

            {/* Signature pad — the typed name renders as a signature */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 pt-3 pb-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Type your full name"
                autoComplete="name"
                className="w-full bg-transparent outline-none text-gray-900 text-base"
                style={{ fontFamily: hasName ? "'Caveat', cursive" : undefined, fontSize: hasName ? 32 : 16, lineHeight: 1.2 }}
              />
              <div className="flex items-center justify-between border-t border-gray-200 mt-1 pt-1.5">
                <span className="text-[11px] text-gray-400">Signature</span>
                <span className="text-[11px] text-gray-400">{hasName ? today : 'Date'}</span>
              </div>
            </div>

            <label className="flex items-start gap-2.5 mt-4 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-[#0b1320] flex-shrink-0"
              />
              <span className="text-[13px] leading-snug text-gray-600">
                I have read and agree to the terms of this Service Agreement, and I am authorised to sign on behalf of {data.clientName}.
              </span>
            </label>

            {error && <div className="mt-3 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-600">{error}</div>}

            <button
              onClick={sign}
              disabled={!hasName || !agreed || busy}
              className="w-full mt-4 inline-flex items-center justify-center gap-2 bg-[#0b1320] text-white text-[15px] font-bold rounded-xl py-4 disabled:opacity-40 active:scale-[0.99] transition-all"
            >
              {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing…</> : <><ShieldCheck className="w-4 h-4" /> Sign &amp; Confirm</>}
            </button>
            <p className="text-[11px] text-gray-400 text-center mt-3">
              By signing you agree this electronic signature is legally binding.
            </p>
          </div>
        </div>
      )}

      {signed && (
        <footer className="text-center py-8 px-5">
          <p className="text-slate-500 text-xs">
            Signed by {signed.name} on {signed.date} · Delta Cleaning Pty Ltd
          </p>
        </footer>
      )}
    </div>
  )
}
