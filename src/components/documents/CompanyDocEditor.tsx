'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Loader2, Download, Move } from 'lucide-react'
import { saveProposalDocAction } from '@/actions/proposal-docs'

type Pos = { x: number; y: number } // percentages of the preview box
type Fields = { preparedFor: string; quotedPrice: string }
type Overlay = { name: Pos; price: Pos }

const DEFAULT_OVERLAY: Overlay = { name: { x: 8, y: 82 }, price: { x: 8, y: 90 } }

export function CompanyDocEditor({
  id, initialData, pdfUrl, docTitle,
}: {
  id: string
  initialData: any
  pdfUrl: string
  docTitle: string
}) {
  // Price only applies to quote-style documents (proposals / agreements / quotes).
  const showPrice = /proposal|agreement|quote|bond|residential/i.test(pdfUrl + ' ' + docTitle)

  const [fields, setFields] = useState<Fields>({
    preparedFor: initialData?.docFields?.preparedFor ?? initialData?.clientName ?? '',
    quotedPrice: initialData?.docFields?.quotedPrice ?? '',
  })
  const [overlay, setOverlay] = useState<Overlay>({
    name:  initialData?.overlay?.name  ?? DEFAULT_OVERLAY.name,
    price: initialData?.overlay?.price ?? DEFAULT_OVERLAY.price,
  })
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('saved')
  const boxRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<null | 'name' | 'price'>(null)
  const firstRun = useRef(true)

  // Debounced autosave whenever fields or positions change
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return }
    setSaved('saving')
    const t = setTimeout(async () => {
      const data = {
        ...initialData,
        clientName: fields.preparedFor || initialData?.clientName,
        docFields: fields,
        overlay,
      }
      await saveProposalDocAction(id, data)
      setSaved('saved')
    }, 700)
    return () => clearTimeout(t)
  }, [fields, overlay, id]) // eslint-disable-line react-hooks/exhaustive-deps

  const onDrag = useCallback((e: MouseEvent) => {
    if (!dragging.current || !boxRef.current) return
    const r = boxRef.current.getBoundingClientRect()
    const x = Math.min(96, Math.max(2, ((e.clientX - r.left) / r.width) * 100))
    const y = Math.min(97, Math.max(2, ((e.clientY - r.top) / r.height) * 100))
    setOverlay((o) => ({ ...o, [dragging.current === 'name' ? 'name' : 'price']: { x, y } }))
  }, [])

  const stopDrag = useCallback(() => {
    dragging.current = null
    window.removeEventListener('mousemove', onDrag)
    window.removeEventListener('mouseup', stopDrag)
  }, [onDrag])

  const startDrag = (which: 'name' | 'price') => (e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = which
    window.addEventListener('mousemove', onDrag)
    window.addEventListener('mouseup', stopDrag)
  }

  const Chip = ({ which, text }: { which: 'name' | 'price'; text: string }) => {
    const pos = which === 'name' ? overlay.name : overlay.price
    return (
      <div
        onMouseDown={startDrag(which)}
        style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
        className="absolute -translate-y-1/2 cursor-move select-none group"
        title="Drag to position on the document"
      >
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-white font-semibold text-[15px] whitespace-nowrap"
          style={{ textShadow: '0 1px 4px rgba(0,0,0,0.55)', outline: '1px dashed rgba(255,255,255,0.5)' }}>
          <Move className="w-3 h-3 opacity-0 group-hover:opacity-70" />
          {text || (which === 'name' ? 'Name…' : 'Price…')}
        </span>
      </div>
    )
  }

  return (
    <div className="h-[calc(100dvh-3.5rem)] flex flex-col -m-4 lg:-m-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-5 h-14 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/documents" className="text-gray-400 hover:text-gray-700"><ArrowLeft className="w-4 h-4" /></Link>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{docTitle}</p>
            <p className="text-[11px] text-gray-400">Company document</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-[11px] text-gray-400 inline-flex items-center gap-1">
            {saved === 'saving' ? <><Loader2 className="w-3 h-3 animate-spin" /> Saving…</> : <><Check className="w-3 h-3 text-emerald-500" /> Saved</>}
          </span>
          <a href={pdfUrl} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white border border-gray-200 text-gray-700 hover:border-gray-300 rounded-lg px-3 py-2 transition-colors">
            <Download className="w-3.5 h-3.5" /> Open PDF
          </a>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Left: editable fields */}
        <div className="w-full lg:w-[360px] flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto p-5 space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Document details</h3>
            <p className="text-xs text-gray-400 mt-0.5">Fill these in, then drag each onto the right spot on the document.</p>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Name (Prepared for)</label>
            <input
              value={fields.preparedFor}
              onChange={(e) => setFields((f) => ({ ...f, preparedFor: e.target.value }))}
              placeholder="e.g. Northpoint Commercial"
              className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00250e]/25 focus:border-[#00250e]"
            />
          </div>
          {showPrice && (
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Quoted price</label>
              <input
                value={fields.quotedPrice}
                onChange={(e) => setFields((f) => ({ ...f, quotedPrice: e.target.value }))}
                placeholder="e.g. $5,400 / month"
                className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00250e]/25 focus:border-[#00250e]"
              />
            </div>
          )}
          <p className="text-[11px] text-gray-400 leading-relaxed border-t border-gray-100 pt-4">
            Changes save automatically. The document shows the cover page — drag the
            <span className="font-semibold text-gray-500"> Name</span>{showPrice && <> and <span className="font-semibold text-gray-500">Price</span></>} labels onto the correct positions.
          </p>
        </div>

        {/* Right: PDF cover with draggable overlay */}
        <div className="flex-1 overflow-auto bg-[#E6E8EB] p-4 flex items-start justify-center">
          <div ref={boxRef} className="relative bg-white shadow-lg w-full max-w-[560px]" style={{ aspectRatio: '1 / 1' }}>
            <iframe
              src={`${pdfUrl}#page=1&view=Fit&toolbar=0&navpanes=0`}
              title="Company document cover"
              className="absolute inset-0 w-full h-full pointer-events-none"
            />
            <Chip which="name" text={fields.preparedFor} />
            {showPrice && <Chip which="price" text={fields.quotedPrice} />}
          </div>
        </div>
      </div>
    </div>
  )
}
