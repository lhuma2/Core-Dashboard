'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Check, PenLine } from 'lucide-react'
import { submitCompanyDocSignatureAction } from '@/actions/signing'

const PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.1.200/build/pdf.worker.min.mjs'
const DOC_FONT = 'Arial, "Helvetica Neue", Helvetica, "Liberation Sans", Arimo, sans-serif'
const SIGN_FONT = '"Segoe Script", "Brush Script MT", "Snell Roundhand", "Apple Chancery", cursive'

type FieldType = 'clientName' | 'quotedPrice' | 'text' | 'signature'
type BgStyle = 'white' | 'dark' | 'none'
type Placement = { id: string; type: FieldType; page: number; x: number; y: number; text?: string; bg?: BgStyle; size?: number }
type PageImg = { src: string; aspect: number }

function boxStyle(bg: BgStyle, size: number, font: string): React.CSSProperties {
  const base: React.CSSProperties = { fontFamily: font, fontSize: size, lineHeight: 1.15, fontWeight: 400, padding: '2px 6px', borderRadius: 4 }
  if (bg === 'white') return { ...base, background: '#ffffff', color: '#111827' }
  if (bg === 'dark') return { ...base, background: '#00250e', color: '#ffffff' }
  return { ...base, background: 'transparent', color: '#111827' }
}

export function CompanyDocSignExperience({
  code, pdfUrl, data, docTitle, alreadySigned,
}: { code: string; pdfUrl: string; data: any; docTitle: string; alreadySigned: boolean }) {
  const values = data?.fieldValues ?? {}
  const [placements, setPlacements] = useState<Placement[]>(data?.placements ?? [])
  const [pages, setPages] = useState<PageImg[]>([])
  const [loadingMsg, setLoadingMsg] = useState('Loading document…')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(alreadySigned)
  const firstSigRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const pdfjs: any = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER
        const pdf = await pdfjs.getDocument({ url: pdfUrl }).promise
        if (cancelled) return
        const out: PageImg[] = []
        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) return
          setLoadingMsg(`Loading page ${i} of ${pdf.numPages}…`)
          const page = await pdf.getPage(i)
          const viewport = page.getViewport({ scale: 1.4 })
          const canvas = document.createElement('canvas')
          canvas.width = viewport.width; canvas.height = viewport.height
          const ctx = canvas.getContext('2d')!
          await page.render({ canvasContext: ctx, viewport, canvas }).promise
          out.push({ src: canvas.toDataURL('image/jpeg', 0.82), aspect: viewport.height / viewport.width })
          setPages([...out])
        }
        setLoadingMsg('')
      } catch { setLoadingMsg('Could not load this document.') }
    })()
    return () => { cancelled = true }
  }, [pdfUrl])

  const setSig = (id: string, text: string) =>
    setPlacements((p) => p.map((x) => (x.id === id ? { ...x, text } : x)))

  const hasSignature = placements.some((p) => p.type === 'signature' && String(p.text ?? '').trim())

  async function submit() {
    setErr(null)
    if (!hasSignature) { setErr('Please type your signature to sign.'); firstSigRef.current?.focus(); return }
    setBusy(true)
    const res = await submitCompanyDocSignatureAction(code, placements)
    setBusy(false)
    if (res?.error) { setErr(res.error); return }
    setDone(true)
  }

  const valueFor = (pl: Placement) =>
    pl.type === 'clientName' ? (values.clientName ?? '')
    : pl.type === 'quotedPrice' ? (values.quotedPrice ?? '')
    : (pl.text ?? '')

  let sigIndex = 0

  return (
    <div className="min-h-[100dvh] bg-[#0d1512] flex flex-col">
      {/* Header */}
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
            <h1 className="text-white text-xl font-bold mb-1">Signed — thank you</h1>
            <p className="text-slate-400 text-sm max-w-xs mx-auto">Your signed document has been sent to Core Cleaning. You can close this page.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-4">
            {pages.length === 0 && (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> {loadingMsg}
              </div>
            )}
            <div className="max-w-[720px] mx-auto space-y-4 pb-24">
              {pages.map((pg, i) => {
                const pageNum = i + 1
                return (
                  <div key={i} className="relative bg-white shadow-md w-full" style={{ aspectRatio: `1 / ${pg.aspect}` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={pg.src} alt={`Page ${pageNum}`} className="absolute inset-0 w-full h-full" draggable={false} />
                    {placements.filter((pl) => pl.page === pageNum).map((pl) => {
                      const bg = pl.bg ?? 'white'
                      const size = pl.size ?? 15
                      if (pl.type === 'signature') {
                        const isFirst = sigIndex++ === 0
                        return (
                          <div key={pl.id} style={{ left: `${pl.x}%`, top: `${pl.y}%` }} className="absolute -translate-y-1/2">
                            <input
                              ref={isFirst ? firstSigRef : undefined}
                              value={pl.text ?? ''}
                              onChange={(e) => setSig(pl.id, e.target.value)}
                              placeholder="Sign here"
                              size={Math.max(8, (pl.text ?? '').length)}
                              style={{ fontFamily: SIGN_FONT, fontSize: size, color: '#111827' }}
                              className="bg-yellow-100/70 outline outline-1 outline-amber-400 rounded px-1 min-w-[7rem]"
                            />
                          </div>
                        )
                      }
                      return (
                        <div key={pl.id} style={{ ...boxStyle(bg, size, DOC_FONT), left: `${pl.x}%`, top: `${pl.y}%` }} className="absolute -translate-y-1/2 inline-flex items-center whitespace-nowrap">
                          {valueFor(pl)}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Sign bar */}
          <div className="flex-shrink-0 bg-white border-t border-gray-200 px-5 py-3 flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500 inline-flex items-center gap-1.5">
              <PenLine className="w-4 h-4 text-[#00250e]" />
              {hasSignature ? 'Ready to submit.' : 'Type your name in the highlighted signature box.'}
              {err && <span className="text-red-500 ml-2">{err}</span>}
            </p>
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
