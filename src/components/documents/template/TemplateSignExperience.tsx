'use client'

import { useRef, useState } from 'react'
import { Loader2, Check, PenLine } from 'lucide-react'
import { SIGNATURE_FONT, fontStack, sortFields, type TemplateDocData } from '@/lib/documents/template'
import { submitTemplateDocSignatureAction } from '@/actions/signing'
import { usePdfPages } from './usePdfPages'
import { TemplatePage, useTemplateFonts } from './TemplatePage'

// What the client sees from the emailed signing link for a template document:
// the filled-in document, with a box to type their signature into at each
// signature spot (or, if the template has none, one at the bottom of the page).
export function TemplateSignExperience({
  code, pdfUrl, data, docTitle, alreadySigned,
}: { code: string; pdfUrl: string; data: TemplateDocData; docTitle: string; alreadySigned: boolean }) {
  const fields = sortFields(data.template.fields)
  const sigFields = fields.filter((f) => f.kind === 'signature')
  const { pages, message } = usePdfPages(pdfUrl)
  const [sigs, setSigs] = useState<Record<string, string>>({})
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(alreadySigned)
  const firstRef = useRef<HTMLInputElement>(null)

  useTemplateFonts(fields)

  const signedName = sigFields.length ? (Object.values(sigs).find((v) => v.trim()) ?? '') : name
  const ready = sigFields.length ? sigFields.every((f) => (sigs[f.id] ?? '').trim()) : name.trim().length > 1

  async function submit() {
    setErr(null)
    if (!ready) { setErr(sigFields.length > 1 ? 'Please sign in every highlighted box.' : 'Please type your signature to sign.'); firstRef.current?.focus(); return }
    setBusy(true)
    const res = await submitTemplateDocSignatureAction(code, sigs, signedName.trim())
    setBusy(false)
    if (res?.error) { setErr(res.error); return }
    setDone(true)
  }

  return (
    <div className="min-h-[100dvh] bg-[#0d1512] flex flex-col">
      <div className="flex items-center justify-between px-5 h-14 bg-[#00250e] text-white flex-shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/proposal-assets/wordmark-white.png" alt="Core Cleaning" className="h-7 object-contain" />
        <span className="text-xs text-slate-300 truncate max-w-[50%]">{docTitle}</span>
      </div>

      {done ? (
        <div className="flex-1 flex items-center justify-center p-8 text-center">
          <div>
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <Check className="w-7 h-7 text-emerald-400" />
            </div>
            <h1 className="text-white text-xl font-bold mb-1">Signed, thank you</h1>
            <p className="text-slate-400 text-sm max-w-xs mx-auto">Your signed document has been sent to Core Cleaning. You can close this page.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-4">
            {pages.length === 0 && (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> {message}
              </div>
            )}
            <div className="max-w-[720px] mx-auto space-y-4 pb-24">
              {pages.map((pg, i) => (
                <TemplatePage key={i} page={pg} pageNum={i + 1} fields={fields.filter((f) => f.kind === 'text')} values={data.values ?? {}}>
                  {sigFields.filter((f) => f.page === i + 1).map((f, k) => (
                    <input
                      key={f.id}
                      ref={i === 0 && k === 0 ? firstRef : undefined}
                      value={sigs[f.id] ?? ''}
                      onChange={(e) => setSigs((s) => ({ ...s, [f.id]: e.target.value }))}
                      placeholder="Sign here"
                      style={{
                        left: `${(f.x / pg.w) * 100}%`, top: `${(f.y / pg.h) * 100}%`,
                        width: `${(f.w / pg.w) * 100}%`, height: `${(f.h / pg.h) * 100}%`,
                        fontFamily: fontStack(SIGNATURE_FONT),
                        color: f.color,
                      }}
                      className="absolute bg-yellow-100/70 outline outline-1 outline-amber-400 rounded px-1 text-[18px]"
                    />
                  ))}
                </TemplatePage>
              ))}
            </div>
          </div>

          <div className="flex-shrink-0 bg-white border-t border-gray-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3">
            {sigFields.length === 0 ? (
              <label className="flex items-center gap-2 flex-1 min-w-[220px]">
                <PenLine className="w-4 h-4 text-[#00250e] flex-shrink-0" />
                <input ref={firstRef} value={name} onChange={(e) => setName(e.target.value)} placeholder="Type your full name to sign"
                  style={{ fontFamily: fontStack(SIGNATURE_FONT) }}
                  className="flex-1 px-3 py-2 bg-yellow-50 border border-amber-300 rounded-lg text-lg text-gray-900 placeholder:font-sans placeholder:text-sm placeholder-gray-400 focus:outline-none" />
              </label>
            ) : (
              <p className="text-xs text-gray-500 inline-flex items-center gap-1.5">
                <PenLine className="w-4 h-4 text-[#00250e]" />
                {ready ? 'Ready to submit.' : 'Type your name in the highlighted signature box.'}
              </p>
            )}
            {err && <span className="text-xs text-red-500">{err}</span>}
            <button onClick={submit} disabled={busy}
              className="inline-flex items-center gap-1.5 bg-[#003314] hover:bg-[#00250e] text-white text-sm font-semibold rounded-lg px-5 py-2.5 disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Sign &amp; submit
            </button>
          </div>
        </>
      )}
    </div>
  )
}
