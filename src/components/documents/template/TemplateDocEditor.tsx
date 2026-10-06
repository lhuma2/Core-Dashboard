'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Loader2, Download, Send, RotateCcw, PenLine, AlertCircle } from 'lucide-react'
import { fieldValue, isChanged, sortFields, type TemplateDocData } from '@/lib/documents/template'
import { CLIENT_TYPE_LABELS, clientTypeOf, type ClientType } from '@/lib/documents/quote'
import { saveTemplateDocAction } from '@/actions/doc-templates'
import { saveFlattenedPdfAction } from '@/actions/proposal-docs'
import { SendCompanyDocModal } from '@/components/documents/SendCompanyDocModal'
import { usePdfPages } from './usePdfPages'
import { TemplatePage, useTemplateFonts } from './TemplatePage'

// Proposal / agreement editor for documents made from a company-document
// template: text boxes on the left, the document on the right, and every edit
// drawn straight onto the page in the template's own font and colour.
export function TemplateDocEditor({
  id, kind, pdfUrl, data, status,
}: { id: string; kind?: string; pdfUrl: string; data: TemplateDocData; status?: string }) {
  const isQuote = kind === 'proposal'
  const fields = sortFields(data.template.fields)
  const { pages, message } = usePdfPages(pdfUrl)
  const [values, setValues] = useState<Record<string, string>>(data.values ?? {})
  const [clientName, setClientName] = useState(data.clientName ?? '')
  const [clientType, setClientType] = useState<ClientType>(clientTypeOf(data))
  const [activeId, setActiveId] = useState<string | null>(null)
  const [saved, setSaved] = useState<'saved' | 'saving' | 'error'>('saved')
  const [showSend, setShowSend] = useState(false)
  const inputRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({})
  const pageRefs = useRef<(HTMLDivElement | null)[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const firstRun = useRef(true)

  useTemplateFonts(fields)

  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return }
    setSaved('saving')
    const t = setTimeout(async () => {
      const res = await saveTemplateDocAction(id, { clientName, values, ...(isQuote ? { clientType } : {}) })
      setSaved(res?.error ? 'error' : 'saved')
    }, 600)
    return () => clearTimeout(t)
  }, [values, clientName, clientType, id, isQuote])

  // Bring the field being typed in into view on the document.
  const reveal = (fid: string) => {
    setActiveId(fid)
    const f = fields.find((x) => x.id === fid)
    const pageEl = f && pageRefs.current[f.page - 1]
    const box = scrollRef.current
    const pg = f && pages[f.page - 1]
    if (!f || !pageEl || !box || !pg) return
    const pr = pageEl.getBoundingClientRect()
    const br = box.getBoundingClientRect()
    const fieldTop = pr.top + (f.y / pg.h) * pr.height
    if (fieldTop < br.top + 40 || fieldTop > br.bottom - 80) {
      box.scrollBy({ top: fieldTop - br.top - br.height / 3, behavior: 'smooth' })
    }
  }

  const setValue = (fid: string, v: string) => setValues((vs) => ({ ...vs, [fid]: v }))
  const reset = (fid: string) => setValues((vs) => { const n = { ...vs }; delete n[fid]; return n })

  const textFields = fields.filter((f) => f.kind === 'text')
  const sigFields = fields.filter((f) => f.kind === 'signature')

  return (
    <div className="h-[calc(100dvh-3.5rem)] flex flex-col -m-4 lg:-m-8">
      <div className="flex items-center justify-between gap-3 px-5 h-14 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/documents" className="text-gray-400 hover:text-gray-700"><ArrowLeft className="w-4 h-4" /></Link>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{clientName || data.templateName}</p>
            <p className="text-[11px] text-gray-400 truncate">{data.templateName}{data.refNumber ? ` · ${data.refNumber}` : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 lg:gap-3 flex-shrink-0">
          <span className="hidden sm:inline-flex text-[11px] text-gray-400 items-center gap-1">
            {saved === 'saving' ? <><Loader2 className="w-3 h-3 animate-spin" /> Saving…</>
              : saved === 'error' ? <><AlertCircle className="w-3 h-3 text-red-500" /> Not saved</>
              : <><Check className="w-3 h-3 text-emerald-500" /> Saved</>}
          </span>
          <a href={`/api/documents/${id}/flatten`}
            onClick={(e) => { if (saved === 'saving') { e.preventDefault(); return } saveFlattenedPdfAction(id) }}
            title="Downloads the document with your changes built into the PDF"
            aria-disabled={saved === 'saving'}
            className="aria-disabled:opacity-50 inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700 hover:border-emerald-300 rounded-lg px-3 py-2 transition-colors">
            <Download className="w-3.5 h-3.5" /> {status === 'signed' ? 'Download Signed PDF' : 'Download PDF'}
          </a>
          <button onClick={() => setShowSend(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#003314] hover:bg-[#00250e] text-white rounded-lg px-3 py-2 transition-colors">
            <Send className="w-3.5 h-3.5" /> Send
          </button>
        </div>
      </div>
      {showSend && <SendCompanyDocModal id={id} onClose={() => setShowSend(false)} quote={isQuote ? { clientType, accepted: status === 'accepted' } : undefined} />}

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Left: one text box per editable part of the template */}
        <div className="w-full lg:w-[360px] flex-shrink-0 border-b lg:border-b-0 lg:border-r border-gray-200 bg-white overflow-y-auto p-4 lg:p-5 space-y-4 max-h-[40vh] lg:max-h-none">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-gray-700">Client (shown in your documents list)</span>
            <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="e.g. Northpoint Commercial"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00250e]/25 focus:border-[#00250e]" />
          </label>
          {isQuote && (
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-gray-700">Client type</span>
              <select value={clientType} onChange={(e) => setClientType(e.target.value as ClientType)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#00250e]/25 focus:border-[#00250e]">
                {(Object.keys(CLIENT_TYPE_LABELS) as ClientType[]).map((t) => <option key={t} value={t}>{CLIENT_TYPE_LABELS[t]}</option>)}
              </select>
              <span className="block text-[11px] text-gray-400 leading-snug">
                {clientType === 'commercial'
                  ? 'Once they sign, a client profile is created and you can send them the portal welcome page.'
                  : 'Once they sign, you’re prompted to add them on the Clients tab. No portal welcome page.'}
              </span>
            </label>
          )}
          <div className="border-t border-gray-100" />
          {textFields.length === 0 && <p className="text-sm text-gray-400">This template has no text fields.</p>}
          {textFields.map((f) => {
            const v = fieldValue(f, values)
            const changed = isChanged(f, v)
            const cls = `w-full px-3 py-2 bg-white border rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00250e]/25 focus:border-[#00250e] ${activeId === f.id ? 'border-emerald-400' : 'border-gray-200'}`
            return (
              <div key={f.id} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-gray-700 truncate">{f.label || 'Field'}</span>
                  {changed && (
                    <button onClick={() => reset(f.id)} title="Back to the template's text" className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-700">
                      <RotateCcw className="w-3 h-3" /> Reset
                    </button>
                  )}
                </div>
                {f.multiline ? (
                  <textarea
                    ref={(el) => { inputRefs.current[f.id] = el }}
                    rows={Math.max(2, v.split('\n').length)}
                    value={v}
                    onFocus={() => reveal(f.id)}
                    onChange={(e) => setValue(f.id, e.target.value)}
                    placeholder={f.defaultValue || f.label}
                    className={cls}
                  />
                ) : (
                  <input
                    ref={(el) => { inputRefs.current[f.id] = el }}
                    value={v}
                    onFocus={() => reveal(f.id)}
                    onChange={(e) => setValue(f.id, e.target.value)}
                    placeholder={f.defaultValue || f.label}
                    className={cls}
                  />
                )}
              </div>
            )
          })}
          {sigFields.length > 0 && (
            <p className="text-[11px] text-gray-500 leading-relaxed border-t border-gray-100 pt-3 flex gap-1.5">
              <PenLine className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-px" />
              The highlighted signature {sigFields.length === 1 ? 'spot is' : 'spots are'} filled in by your client when you send it to sign.
            </p>
          )}
        </div>

        {/* Right: the document itself */}
        <div className="flex-1 relative min-h-0">
          <div ref={scrollRef} className="absolute inset-0 overflow-auto bg-[#E6E8EB] p-4" onClick={() => setActiveId(null)}>
            {pages.length === 0 && (
              <div className="h-full flex items-center justify-center text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> {message}
              </div>
            )}
            <div className="mx-auto space-y-4 max-w-[760px]">
              {pages.map((pg, i) => (
                <TemplatePage
                  key={i}
                  pageRef={(el) => { pageRefs.current[i] = el }}
                  page={pg}
                  pageNum={i + 1}
                  fields={fields}
                  values={values}
                  signatures={data.signatures}
                  highlightId={activeId}
                  onFieldClick={(fid) => {
                    const el = inputRefs.current[fid]
                    if (el) { el.focus(); el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }
                    setActiveId(fid)
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
