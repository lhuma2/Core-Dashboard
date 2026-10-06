'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Check, ArrowRight } from 'lucide-react'
import { sortFields, type TemplateDocData } from '@/lib/documents/template'
import { acceptQuoteAction } from '@/actions/quotes'
import { usePdfPages } from './usePdfPages'
import { TemplatePage, useTemplateFonts } from './TemplatePage'

// What the client sees from the emailed quote link: the filled-in quote with an
// "Accept quote" button. Accepting issues their prefilled service agreement and
// takes them straight to it to choose a start date and sign.
export function QuoteAcceptExperience({
  code, pdfUrl, data, docTitle, accepted, agreementCode,
}: {
  code: string
  pdfUrl: string
  data: TemplateDocData
  docTitle: string
  accepted: boolean
  agreementCode: string | null
}) {
  const router = useRouter()
  const fields = sortFields(data.template.fields).filter((f) => f.kind === 'text')
  const { pages, message } = usePdfPages(pdfUrl)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useTemplateFonts(fields)

  async function accept() {
    if (busy) return
    setErr(null); setBusy(true)
    const res = await acceptQuoteAction(code)
    if ('error' in res) { setBusy(false); setErr(res.error); return }
    router.push(`/sign/${res.agreementCode}`)
  }

  return (
    <div className="min-h-[100dvh] bg-[#0d1512] flex flex-col">
      <div className="flex items-center justify-between px-5 h-14 bg-[#00250e] text-white flex-shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/proposal-assets/wordmark-white.png" alt="Core Cleaning" className="h-7 object-contain" />
        <span className="text-xs text-slate-300 truncate max-w-[50%]">{docTitle}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {pages.length === 0 && (
          <div className="h-full flex items-center justify-center text-sm text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> {message}
          </div>
        )}
        <div className="max-w-[720px] mx-auto space-y-4 pb-28">
          {pages.map((pg, i) => (
            <TemplatePage key={i} page={pg} pageNum={i + 1} fields={fields} values={data.values ?? {}} />
          ))}
        </div>
      </div>

      <div className="sticky bottom-0 flex-shrink-0 bg-white border-t border-gray-200 px-5 py-3">
        <div className="max-w-[720px] mx-auto flex flex-wrap items-center justify-between gap-3">
          {accepted ? (
            <>
              <p className="text-sm text-gray-700 inline-flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600" /> You&apos;ve accepted this quote.
              </p>
              {agreementCode && (
                <a href={`/sign/${agreementCode}`}
                  className="inline-flex items-center gap-1.5 bg-[#003314] hover:bg-[#00250e] text-white text-sm font-semibold rounded-lg px-5 py-2.5">
                  Open your agreement <ArrowRight className="w-4 h-4" />
                </a>
              )}
            </>
          ) : (
            <>
              <p className="text-xs text-gray-500 max-w-sm">
                Happy with the quote? Accept it and your service agreement opens straight away, already filled in. You just choose a start date and sign.
              </p>
              {err && <span className="text-xs text-red-500">{err}</span>}
              <button onClick={accept} disabled={busy}
                className="inline-flex items-center gap-1.5 bg-[#003314] hover:bg-[#00250e] text-white text-sm font-bold rounded-lg px-6 py-3 disabled:opacity-50">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Accept quote
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
