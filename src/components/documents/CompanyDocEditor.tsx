'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Loader2, Download, GripVertical, X, User, DollarSign, Type, Palette, PenLine, Send } from 'lucide-react'
import { saveProposalDocAction } from '@/actions/proposal-docs'
import { SendCompanyDocModal } from '@/components/documents/SendCompanyDocModal'

const PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.1.200/build/pdf.worker.min.mjs'

type FieldType = 'clientName' | 'quotedPrice' | 'text' | 'signature'
type BgStyle = 'white' | 'dark' | 'none'
type Placement = { id: string; type: FieldType; page: number; x: number; y: number; text?: string; bg?: BgStyle; size?: number; w?: number; h?: number } // x,y,w,h = % of page

const EDITABLE: FieldType[] = ['text', 'signature']
const BG_CYCLE: BgStyle[] = ['white', 'dark', 'none']
// Matches the contract PDFs, which are set in Arial (ArialMT).
const DOC_FONT = 'Arial, "Helvetica Neue", Helvetica, "Liberation Sans", Arimo, sans-serif'
const SIGN_FONT = '"Segoe Script", "Brush Script MT", "Snell Roundhand", "Apple Chancery", cursive'
function boxStyle(bg: BgStyle, size: number, font: string): React.CSSProperties {
  const base: React.CSSProperties = { fontFamily: font, fontSize: size, lineHeight: 1.15, fontWeight: 400, padding: '2px 6px', borderRadius: 4 }
  if (bg === 'white') return { ...base, background: '#ffffff', color: '#111827' }
  if (bg === 'dark')  return { ...base, background: '#00250e', color: '#ffffff' }
  return { ...base, background: 'transparent', color: '#111827', textShadow: '0 1px 4px rgba(255,255,255,0.9)' }
}
type FieldValues = { clientName: string; quotedPrice: string }
type PageImg = { src: string; aspect: number } // aspect = height / width

const FIELD_META: Record<FieldType, { label: string; icon: any; placeholder: string }> = {
  clientName:  { label: 'Client Name',  icon: User,       placeholder: 'e.g. Northpoint Commercial' },
  quotedPrice: { label: 'Quoted Price', icon: DollarSign, placeholder: 'e.g. $5,400 / month' },
  text:        { label: 'Text box',     icon: Type,       placeholder: '' },
  signature:   { label: 'Signature',    icon: PenLine,    placeholder: '' },
}

export function CompanyDocEditor({
  id, initialData, pdfUrl, docTitle,
}: { id: string; initialData: any; pdfUrl: string; docTitle: string }) {
  const [values, setValues] = useState<FieldValues>({
    clientName:  initialData?.fieldValues?.clientName ?? initialData?.clientName ?? '',
    quotedPrice: initialData?.fieldValues?.quotedPrice ?? '',
  })
  const [placements, setPlacements] = useState<Placement[]>(initialData?.placements ?? [])
  const [pages, setPages] = useState<PageImg[]>([])
  const [loadingMsg, setLoadingMsg] = useState('Loading document…')
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('saved')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showSend, setShowSend] = useState(false)

  const pageRefs = useRef<(HTMLDivElement | null)[]>([])
  const dragging = useRef<null | { id: string }>(null)
  const firstRun = useRef(true)

  // ── Render the PDF to page images (client only) ──────────────────────────
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
          setLoadingMsg(`Rendering page ${i} of ${pdf.numPages}…`)
          const page = await pdf.getPage(i)
          const viewport = page.getViewport({ scale: 1.4 })
          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          const ctx = canvas.getContext('2d')!
          await page.render({ canvasContext: ctx, viewport, canvas }).promise
          out.push({ src: canvas.toDataURL('image/jpeg', 0.82), aspect: viewport.height / viewport.width })
          setPages([...out])
        }
        setLoadingMsg('')
      } catch (e: any) {
        setLoadingMsg('Could not render this document. You can still open it with the button above.')
      }
    })()
    return () => { cancelled = true }
  }, [pdfUrl])

  // ── Autosave ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return }
    setSaved('saving')
    const t = setTimeout(async () => {
      await saveProposalDocAction(id, {
        ...initialData,
        clientName: values.clientName || initialData?.clientName,
        fieldValues: values,
        placements,
      })
      setSaved('saved')
    }, 700)
    return () => clearTimeout(t)
  }, [values, placements, id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Drop a NEW field from the palette onto a page ────────────────────────
  const onDropField = (pageNum: number) => (e: React.DragEvent) => {
    e.preventDefault()
    const type = e.dataTransfer.getData('fieldType') as FieldType
    if (!type) return
    const wrap = pageRefs.current[pageNum - 1]
    if (!wrap) return
    const r = wrap.getBoundingClientRect()
    const x = Math.min(96, Math.max(1, ((e.clientX - r.left) / r.width) * 100))
    const y = Math.min(98, Math.max(1, ((e.clientY - r.top) / r.height) * 100))
    const isSig = type === 'signature'
    const id = Math.random().toString(36).slice(2)
    setPlacements((p) => [...p, { id, type, page: pageNum, x, y, bg: isSig ? 'none' : 'white', size: isSig ? 26 : 15, ...(EDITABLE.includes(type) ? { text: '' } : {}) }])
    setSelectedId(id)
  }

  // ── Reposition an EXISTING placement (mouse drag) ────────────────────────
  const onMove = useCallback((e: MouseEvent) => {
    const d = dragging.current
    if (!d) return
    setPlacements((prev) => prev.map((pl) => {
      if (pl.id !== d.id) return pl
      const wrap = pageRefs.current[pl.page - 1]
      if (!wrap) return pl
      const r = wrap.getBoundingClientRect()
      const x = Math.min(97, Math.max(1, ((e.clientX - r.left) / r.width) * 100))
      const y = Math.min(99, Math.max(1, ((e.clientY - r.top) / r.height) * 100))
      return { ...pl, x, y }
    }))
  }, [])
  const stopMove = useCallback(() => {
    dragging.current = null
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', stopMove)
  }, [onMove])
  const startMove = (pid: string) => (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    dragging.current = { id: pid }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', stopMove)
  }

  const removePlacement = (pid: string) => setPlacements((p) => p.filter((x) => x.id !== pid))
  const updateText = (pid: string, text: string) =>
    setPlacements((p) => p.map((x) => (x.id === pid ? { ...x, text } : x)))
  const cycleBg = (pid: string) =>
    setPlacements((p) => p.map((x) => x.id === pid
      ? { ...x, bg: BG_CYCLE[(BG_CYCLE.indexOf(x.bg ?? 'white') + 1) % BG_CYCLE.length] } : x))

  // ── Corner-handle resize (scales font size from the box centre) ──────────
  const resizing = useRef<null | { id: string; cx: number; cy: number; startDist: number; startSize: number }>(null)
  const onResize = useCallback((e: MouseEvent) => {
    const r = resizing.current
    if (!r) return
    const dist = Math.hypot(e.clientX - r.cx, e.clientY - r.cy)
    const next = Math.min(72, Math.max(8, Math.round(r.startSize * (dist / (r.startDist || 1)))))
    setPlacements((prev) => prev.map((pl) => (pl.id === r.id ? { ...pl, size: next } : pl)))
  }, [])
  const stopResize = useCallback(() => {
    resizing.current = null
    window.removeEventListener('mousemove', onResize)
    window.removeEventListener('mouseup', stopResize)
  }, [onResize])
  const startResize = (pid: string, startSize: number) => (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    const box = (e.currentTarget as HTMLElement).parentElement as HTMLElement
    const rect = box.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    resizing.current = { id: pid, cx, cy, startDist: Math.hypot(e.clientX - cx, e.clientY - cy) || 1, startSize }
    window.addEventListener('mousemove', onResize)
    window.addEventListener('mouseup', stopResize)
  }

  // ── Edge (wall) resize — width via left/right, height via top/bottom ─────
  const edgeResizing = useRef<null | { id: string; edge: 'l' | 'r' | 't' | 'b'; pageRect: DOMRect; x: number; y: number; rightPct: number }>(null)
  const onEdge = useCallback((e: MouseEvent) => {
    const r = edgeResizing.current
    if (!r) return
    const mx = ((e.clientX - r.pageRect.left) / r.pageRect.width) * 100
    const my = ((e.clientY - r.pageRect.top) / r.pageRect.height) * 100
    setPlacements((prev) => prev.map((pl) => {
      if (pl.id !== r.id) return pl
      if (r.edge === 'r') return { ...pl, w: Math.min(100, Math.max(1, mx - r.x)) }
      if (r.edge === 'l') { const nx = Math.min(r.rightPct - 1, Math.max(0, mx)); return { ...pl, x: nx, w: Math.max(1, r.rightPct - nx) } }
      if (r.edge === 'b') return { ...pl, h: Math.min(100, Math.max(1, 2 * (my - r.y))) }
      return { ...pl, h: Math.min(100, Math.max(1, 2 * (r.y - my))) }
    }))
  }, [])
  const stopEdge = useCallback(() => {
    edgeResizing.current = null
    window.removeEventListener('mousemove', onEdge)
    window.removeEventListener('mouseup', stopEdge)
  }, [onEdge])
  const startEdge = (pl: Placement, edge: 'l' | 'r' | 't' | 'b') => (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    const pageRect = pageRefs.current[pl.page - 1]?.getBoundingClientRect()
    if (!pageRect) return
    const box = (e.currentTarget as HTMLElement).parentElement as HTMLElement
    const brect = box.getBoundingClientRect()
    const startWpct = pl.w ?? (brect.width / pageRect.width) * 100
    edgeResizing.current = { id: pl.id, edge, pageRect, x: pl.x, y: pl.y, rightPct: pl.x + startWpct }
    window.addEventListener('mousemove', onEdge)
    window.addEventListener('mouseup', stopEdge)
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
          <button onClick={() => setShowSend(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#003314] hover:bg-[#00250e] text-white rounded-lg px-3 py-2 transition-colors">
            <Send className="w-3.5 h-3.5" /> Send
          </button>
        </div>
      </div>
      {showSend && <SendCompanyDocModal id={id} onClose={() => setShowSend(false)} />}

      <div className="flex-1 flex min-h-0">
        {/* Left: field boxes to drag onto the document */}
        <div className="w-full lg:w-[340px] flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Fields</h3>
            <p className="text-xs text-gray-400 mt-0.5">Type a value, then drag the box onto the document where it should appear.</p>
          </div>
          {(Object.keys(FIELD_META) as FieldType[]).map((type) => {
            const meta = FIELD_META[type]
            const Icon = meta.icon
            return (
              <div key={type} className="rounded-xl border border-gray-200 p-3 space-y-2 bg-gray-50/60">
                <div
                  draggable
                  onDragStart={(e) => { e.dataTransfer.setData('fieldType', type); e.dataTransfer.effectAllowed = 'copy' }}
                  className="flex items-center gap-2 cursor-grab active:cursor-grabbing rounded-lg bg-[#00250e] text-white px-3 py-2 text-sm font-semibold select-none"
                  title="Drag me onto the document"
                >
                  <GripVertical className="w-4 h-4 opacity-70" />
                  <Icon className="w-4 h-4" />
                  {meta.label}
                </div>
                {EDITABLE.includes(type) ? (
                  <p className="text-[11px] text-gray-400 px-0.5">Drag on, then type directly on the document.</p>
                ) : (
                  <input
                    value={values[type as 'clientName' | 'quotedPrice']}
                    onChange={(e) => setValues((v) => ({ ...v, [type]: e.target.value }))}
                    placeholder={meta.placeholder}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00250e]/25 focus:border-[#00250e]"
                  />
                )}
              </div>
            )
          })}
          <p className="text-[11px] text-gray-400 leading-relaxed border-t border-gray-100 pt-3">
            Drag a field onto the document — it drops as a white box so it <span className="font-semibold text-gray-500">covers</span> printed
            placeholders like <span className="font-semibold text-gray-500">$0.00</span>. Click a placed field to select it,
            then drag its <span className="font-semibold text-gray-500">corner handles</span> to resize, or use the toolbar to
            move, change background, or remove. Changes save automatically.
          </p>
        </div>

        {/* Right: full scrollable PDF with drop targets */}
        <div className="flex-1 overflow-y-auto bg-[#E6E8EB] p-4" onMouseDown={() => setSelectedId(null)}>
          {pages.length === 0 && (
            <div className="h-full flex items-center justify-center text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> {loadingMsg}
            </div>
          )}
          <div className="max-w-[720px] mx-auto space-y-4">
            {pages.map((pg, i) => {
              const pageNum = i + 1
              return (
                <div
                  key={i}
                  ref={(el) => { pageRefs.current[i] = el }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={onDropField(pageNum)}
                  className="relative bg-white shadow-md w-full"
                  style={{ aspectRatio: `1 / ${pg.aspect}` }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={pg.src} alt={`Page ${pageNum}`} className="absolute inset-0 w-full h-full" draggable={false} />
                  {placements.filter((pl) => pl.page === pageNum).map((pl) => {
                    const bg = pl.bg ?? 'white'
                    const size = pl.size ?? 15
                    const editable = EDITABLE.includes(pl.type)
                    const font = pl.type === 'signature' ? SIGN_FONT : DOC_FONT
                    const selected = selectedId === pl.id
                    const sized = pl.w != null || pl.h != null
                    return (
                      <div
                        key={pl.id}
                        onMouseDownCapture={() => setSelectedId(pl.id)}
                        style={{ left: `${pl.x}%`, top: `${pl.y}%`, width: pl.w != null ? `${pl.w}%` : undefined, height: pl.h != null ? `${pl.h}%` : undefined }}
                        className="absolute -translate-y-1/2 group"
                      >
                        {/* Control toolbar — stays while selected, or on hover */}
                        <div className={`absolute -top-6 left-0 items-center gap-0.5 bg-gray-900 text-white rounded px-1 py-0.5 shadow-lg z-10 whitespace-nowrap ${selected ? 'flex' : 'hidden group-hover:flex'}`}>
                          <button onMouseDown={startMove(pl.id)} className="p-0.5 cursor-move hover:text-emerald-300" aria-label="Move" title="Drag to move"><GripVertical className="w-3 h-3" /></button>
                          <button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); cycleBg(pl.id) }} className="p-0.5 hover:text-emerald-300" aria-label="Background" title="Background: white / dark / none"><Palette className="w-3 h-3" /></button>
                          <button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); removePlacement(pl.id) }} className="p-0.5 hover:text-red-400" aria-label="Remove" title="Remove"><X className="w-3 h-3" /></button>
                        </div>
                        {/* The value box that covers the underlying text */}
                        <div
                          onMouseDown={editable ? undefined : startMove(pl.id)}
                          style={{ ...boxStyle(bg, size, font), ...(sized ? { width: '100%', height: '100%', display: 'flex', alignItems: 'center', overflow: 'hidden' } : {}) }}
                          className={`relative items-center whitespace-nowrap ring-1 ${sized ? 'flex' : 'inline-flex'} ${selected ? 'ring-emerald-400' : 'ring-transparent group-hover:ring-emerald-400/70'} ${editable ? '' : 'cursor-move'}`}
                        >
                          {editable ? (
                            <input
                              value={pl.text ?? ''}
                              onChange={(e) => updateText(pl.id, e.target.value)}
                              onMouseDown={(e) => e.stopPropagation()}
                              placeholder={pl.type === 'signature' ? 'Signature…' : 'Type…'}
                              size={Math.max(4, (pl.text ?? '').length)}
                              style={{ fontFamily: font, fontSize: size, fontWeight: 400, color: 'inherit' }}
                              className="bg-transparent outline-none min-w-[2rem]"
                            />
                          ) : (
                            values[pl.type as 'clientName' | 'quotedPrice'] || FIELD_META[pl.type].label
                          )}
                          {selected && [
                            '-top-1 -left-1 cursor-nwse-resize',
                            '-top-1 -right-1 cursor-nesw-resize',
                            '-bottom-1 -left-1 cursor-nesw-resize',
                            '-bottom-1 -right-1 cursor-nwse-resize',
                          ].map((c, idx) => (
                            <span key={idx} onMouseDown={startResize(pl.id, size)}
                              className={`absolute ${c} w-2 h-2 bg-emerald-500 border border-white rounded-sm z-10`} />
                          ))}
                          {selected && (
                            <>
                              <span onMouseDown={startEdge(pl, 'l')} title="Drag to widen / narrow" className="absolute top-1 bottom-1 -left-1 w-1.5 cursor-ew-resize hover:bg-emerald-400/50 rounded" />
                              <span onMouseDown={startEdge(pl, 'r')} title="Drag to widen / narrow" className="absolute top-1 bottom-1 -right-1 w-1.5 cursor-ew-resize hover:bg-emerald-400/50 rounded" />
                              <span onMouseDown={startEdge(pl, 't')} title="Drag to heighten / shorten" className="absolute left-1 right-1 -top-1 h-1.5 cursor-ns-resize hover:bg-emerald-400/50 rounded" />
                              <span onMouseDown={startEdge(pl, 'b')} title="Drag to heighten / shorten" className="absolute left-1 right-1 -bottom-1 h-1.5 cursor-ns-resize hover:bg-emerald-400/50 rounded" />
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
