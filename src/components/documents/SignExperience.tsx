'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Check, ShieldCheck, PenLine, Download, Lock } from 'lucide-react'
import { AgreementDocument, type SignatureFill } from '@/components/documents/render/AgreementDocument'
import type { AgreementData } from '@/lib/documents/agreement'
import { submitSignatureAction, submitOnboardingAction } from '@/actions/signing'

const WORDMARK_WHITE = '/proposal-assets/wordmark-white.png'

export function SignExperience({
  token, data, alreadySigned,
}: {
  token: string
  data: AgreementData
  alreadySigned: SignatureFill | null
}) {
  const [signed, setSigned] = useState<SignatureFill | null>(alreadySigned)
  const [phase, setPhase] = useState<'sign' | 'onboard'>('sign')
  const [pendingSign, setPendingSign] = useState<SignatureFill | null>(null)
  const [name, setName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [details, setDetails] = useState({ abn: '', billingEmail: '', poNumber: '', siteContactName: '', siteContactPhone: '', notes: '' })
  const setD = (k: keyof typeof details, v: string) => setDetails(prev => ({ ...prev, [k]: v }))

  const today = useMemo(
    () => new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }),
    [],
  )
  const hasName = name.trim().length >= 2

  // ── Fit the A4 document to its column via CSS zoom (reflows, so the column
  //    height stays correct on laptop and mobile). ──
  const paneRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const fit = () => {
      const w = paneRef.current?.clientWidth ?? window.innerWidth
      setScale(Math.min(1, (w - 32) / 794))
    }
    fit()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null
    if (ro && paneRef.current) ro.observe(paneRef.current)
    window.addEventListener('resize', fit)
    return () => { ro?.disconnect(); window.removeEventListener('resize', fit) }
  }, [signed])

  // Step 1 — capture the signature, then move to the onboarding questions.
  async function sign() {
    if (!hasName || !agreed || busy) return
    setBusy(true); setError(null)
    const res = await submitSignatureAction(token, name)
    setBusy(false)
    if (res?.error) { setError(res.error); return }
    const fill = { name: name.trim().replace(/\s+/g, ' '), date: res?.date ?? today }
    if (res?.alreadySigned) { setSigned(fill); window.scrollTo({ top: 0, behavior: 'smooth' }); return }
    setPendingSign(fill)
    setPhase('onboard')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Step 2 — save the onboarding details (or skip), then show the confirmation.
  async function finish(skip: boolean) {
    if (busy || !pendingSign) return
    if (!skip) {
      setBusy(true)
      await submitOnboardingAction(token, details).catch(() => {})
      setBusy(false)
    }
    setSigned(pendingSign)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const inputCls = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400'
  const asideCls = 'sticky bottom-0 z-10 bg-white border-t border-gray-200 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] lg:self-start lg:sticky lg:top-6 lg:bottom-auto lg:w-[380px] lg:flex-shrink-0 lg:border lg:rounded-2xl lg:shadow-xl'

  return (
    <div className="min-h-[100dvh] bg-[#0b1320]">
      {/* ── Header ── */}
      <header className="px-5 pt-8 pb-6 text-center">
        <img src={WORDMARK_WHITE} alt="Core Cleaning" className="h-6 w-auto mx-auto mb-5 opacity-95" />
        {signed ? (
          <>
            <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center mx-auto mb-4">
              <Check className="w-7 h-7 text-emerald-400" />
            </div>
            <h1 className="text-white text-2xl font-bold tracking-tight">You&apos;re all set, {signed.name.split(' ')[0]}.</h1>
            <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto">
              Your service agreement with Core Cleaning is signed and saved. A copy is below — keep it for your records.
            </p>
            <a href={`/sign/${token}/pdf`} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 mt-5 bg-white text-[#0b1320] text-sm font-bold rounded-xl px-5 py-3 active:scale-[0.98] transition-transform">
              <Download className="w-4 h-4" /> Save a copy (PDF)
            </a>
          </>
        ) : phase === 'onboard' ? (
          <>
            <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center mx-auto mb-4">
              <Check className="w-7 h-7 text-emerald-400" />
            </div>
            <h1 className="text-white text-2xl font-bold tracking-tight">Signed — one quick step.</h1>
            <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto">
              Thanks{pendingSign ? `, ${pendingSign.name.split(' ')[0]}` : ''}. A few quick details help us set you up — all optional.
            </p>
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

      {/* ── Document + panel ── */}
      <div className="mx-auto max-w-[1240px] lg:flex lg:items-start lg:gap-6 lg:px-6 lg:pb-12">
        <div ref={paneRef} className="lg:flex-1 lg:min-w-0 bg-[#E6E8EB] lg:rounded-2xl px-3 py-8 flex justify-center">
          <div style={{ zoom: scale } as any}>
            <AgreementDocument data={data} signature={signed ?? pendingSign} />
          </div>
        </div>

        {/* Step 1 — sign */}
        {!signed && phase === 'sign' && (
          <aside className={asideCls}>
            <div className="max-w-[560px] lg:max-w-none mx-auto px-5 py-5 lg:px-6 lg:py-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <PenLine className="w-3.5 h-3.5" /> Sign here
              </p>
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
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#0b1320] flex-shrink-0" />
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
                {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing…</> : <><ShieldCheck className="w-4 h-4" /> Sign &amp; onboard</>}
              </button>
              <p className="text-[11px] text-gray-400 text-center mt-3">
                You&apos;ll answer a couple of quick questions right after. This electronic signature is legally binding.
              </p>
            </div>
          </aside>
        )}

        {/* Step 2 — onboard */}
        {!signed && phase === 'onboard' && (
          <aside className={asideCls}>
            <div className="max-w-[560px] lg:max-w-none mx-auto px-5 py-5 lg:px-6 lg:py-6">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-6 h-6 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center flex-shrink-0"><Check className="w-3.5 h-3.5 text-emerald-600" /></span>
                <p className="text-[13px] font-semibold text-gray-900">Signed — thank you.</p>
              </div>
              <p className="text-xs text-gray-500 mb-4">A few quick details so we can set you up. All optional — skip anything you like.</p>
              <div className="space-y-2.5">
                <input value={details.abn} onChange={(e) => setD('abn', e.target.value)} inputMode="numeric" placeholder="Your ABN (added to your contract)" className={inputCls} />
                <input value={details.billingEmail} onChange={(e) => setD('billingEmail', e.target.value)} type="email" placeholder="Billing / accounts email" className={inputCls} />
                <input value={details.poNumber} onChange={(e) => setD('poNumber', e.target.value)} placeholder="PO number (if you use them)" className={inputCls} />
                <div className="grid grid-cols-2 gap-2">
                  <input value={details.siteContactName} onChange={(e) => setD('siteContactName', e.target.value)} placeholder="Site contact" className={inputCls} />
                  <input value={details.siteContactPhone} onChange={(e) => setD('siteContactPhone', e.target.value)} type="tel" placeholder="Contact phone" className={inputCls} />
                </div>
                <textarea value={details.notes} onChange={(e) => setD('notes', e.target.value)} rows={2} placeholder="Anything else we should know? (access, alarm, pets…)" className={inputCls + ' resize-none'} />
              </div>
              <button
                onClick={() => finish(false)}
                disabled={busy}
                className="w-full mt-4 inline-flex items-center justify-center gap-2 bg-[#0b1320] text-white text-[15px] font-bold rounded-xl py-4 disabled:opacity-40 active:scale-[0.99] transition-all"
              >
                {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Check className="w-4 h-4" /> Finish</>}
              </button>
              <button onClick={() => finish(true)} disabled={busy} className="w-full mt-2 text-[13px] font-semibold text-gray-400 hover:text-gray-600 py-1">
                Skip for now
              </button>
            </div>
          </aside>
        )}
      </div>

      {signed && (
        <footer className="text-center py-8 px-5">
          <p className="text-slate-500 text-xs">
            Signed by {signed.name} on {signed.date} · Core Cleaning
          </p>
        </footer>
      )}
    </div>
  )
}
