'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Loader2, Download, GripVertical, X, User, DollarSign, Type, Palette, PenLine, Send, Plus, Calendar, ZoomIn, ZoomOut } from 'lucide-react'
import { saveProposalDocAction } from '@/actions/proposal-docs'
import { SendCompanyDocModal } from '@/components/documents/SendCompanyDocModal'

const PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.1.200/build/pdf.worker.min.mjs'

type FieldType = 'clientName' | 'quotedPrice' | 'date' | 'text' | 'signature'
type BgStyle = 'white' | 'dark' | 'none'
type Placement = { id: string; type: FieldType; page: number; x: number; y: number; text?: string; bg?: BgStyle; size?: number; w?: number; h?: number } // x,y,w,h = % of page

const EDITABLE: FieldType[] = ['text', 'signature']
const BG_CYCLE: BgStyle[] = ['white', 'dark', 'none']
// Matches the contract PDFs, which are set in Arial (ArialMT).
const DOC_FONT = 'Arial, "Helvetica Neue", Helvetica, "Liberation Sans", Arimo, sans-serif'
const SIGN_FONT = '"Segoe Script", "Brush Script MT", "Snell Roundhand", "Apple Chancery", cursive'
// Matches the printed placeholders on the Bond Cleaning Service Agreement: the "$0.00"
// quote is a high-contrast serif, "Name" is a bold geometric sans.
const PRICE_FONT = '"Playfair Display", Georgia, "Times New Roman", serif'
const NAME_FONT = 'Poppins, "Century Gothic", "Futura", sans-serif'
function fontForType(type: FieldType): string {
  if (type === 'signature') return SIGN_FONT
  if (type === 'quotedPrice') return PRICE_FONT
  if (type === 'clientName') return NAME_FONT
  return DOC_FONT
}
// Layout/background only — font sizing is measured live per-box (see FitBox below).
function boxStyle(bg: BgStyle): React.CSSProperties {
  const base: React.CSSProperties = { lineHeight: 1.15, fontWeight: 400, padding: '2px 6px', borderRadius: 4 }
  if (bg === 'white') return { ...base, background: '#ffffff', color: '#111827' }
  if (bg === 'dark')  return { ...base, background: '#00250e', color: '#ffffff' }
  return { ...base, background: 'transparent', color: '#111827', textShadow: '0 1px 4px rgba(255,255,255,0.9)' }
}
// Measures actual pixel text width for a given font, so long content (e.g. a typed-out
// signature) shrinks to fit a fixed-size box instead of just overflowing it.
let measureCanvasCtx: CanvasRenderingContext2D | null | undefined
function measureTextWidth(text: string, font: string, px: number): number {
  if (measureCanvasCtx === undefined) measureCanvasCtx = document.createElement('canvas').getContext('2d')
  if (!measureCanvasCtx) return text.length * px * 0.6
  measureCanvasCtx.font = `${px}px ${font}`
  return measureCanvasCtx.measureText(text).width
}
// When a box has an explicit width/height (from dragging the wall handles), the text should
// scale to fill it as it's resized — and shrink further if the actual content (e.g. a long
// signature) is too wide to fit at that size. Uses ResizeObserver + canvas text measurement
// instead of CSS container-query units (cqh/cqw), which need iOS 16+/recent WebKit and have
// had inconsistent support — ResizeObserver has worked in Safari since iOS 13.4, so this
// measures and fits identically on iOS, Android, and desktop.
function FitBox({ sized, size, font, text, children }: { sized: boolean; size: number; font: string; text: string; children: (fontPx: number) => React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState(size)
  useEffect(() => {
    if (!sized) return
    const el = ref.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      if (r.width <= 0 || r.height <= 0) return
      let fontPx = Math.min(r.height * 0.72, r.width * 0.22)
      const contentWidth = measureTextWidth(text || ' ', font, fontPx)
      if (contentWidth > r.width) fontPx *= (r.width / contentWidth) * 0.94
      setFit(Math.max(6, fontPx))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [sized, text, font])
  if (!sized) return <>{children(size)}</>
  return <div ref={ref} className="w-full h-full flex items-center justify-center overflow-hidden">{children(fit)}</div>
}
type FieldValues = { clientName: string; quotedPrice: string; date: string }
type PageImg = { src: string; aspect: number } // aspect = height / width

const FIELD_META: Record<FieldType, { label: string; icon: any; placeholder: string }> = {
  clientName:  { label: 'Client Name',  icon: User,       placeholder: 'e.g. Northpoint Commercial' },
  quotedPrice: { label: 'Quoted Price', icon: DollarSign, placeholder: 'e.g. $5,400 / month' },
  date:        { label: 'Date',         icon: Calendar,   placeholder: 'e.g. 14 May 2026' },
  text:        { label: 'Text box',     icon: Type,       placeholder: '' },
  signature:   { label: 'Signature',    icon: PenLine,    placeholder: '' },
}

export function CompanyDocEditor({
  id, initialData, pdfUrl, docTitle,
}: { id: string; initialData: any; pdfUrl: string; docTitle: string }) {
  const [values, setValues] = useState<FieldValues>({
    clientName:  initialData?.fieldValues?.clientName ?? initialData?.clientName ?? '',
    quotedPrice: initialData?.fieldValues?.quotedPrice ?? '',
    date:        initialData?.fieldValues?.date ?? new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }),
  })
  const [placements, setPlacements] = useState<Placement[]>(initialData?.placements ?? [])
  const [pages, setPages] = useState<PageImg[]>([])
  const [loadingMsg, setLoadingMsg] = useState('Loading document…')
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('saved')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showSend, setShowSend] = useState(false)
  const [activePage, setActivePage] = useState(1)
  const [zoom, setZoom] = useState(1)
  const pinch = useRef<null | { d0: number; z0: number }>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<(HTMLDivElement | null)[]>([])
  const dragging = useRef<null | { id: string }>(null)
  const firstRun = useRef(true)

  // ── Render the PDF to page images (client only) ──────────────────────────
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // Check for a dead (0-byte) file up front — this happens when a company
        // document is uploaded straight from a cloud-synced folder (OneDrive,
        // Dropbox, ...) before it's actually downloaded locally, which reads as an
        // empty file. pdfjs's error message for that case isn't clear, so catch it
        // here and say so plainly instead of a generic "could not render" message.
        try {
          const head = await fetch(pdfUrl, { method: 'HEAD' })
          const len = Number(head.headers.get('content-length') ?? '')
          if (head.ok && len === 0) {
            if (!cancelled) setLoadingMsg('This document is empty (0 bytes) — the upload didn’t complete. Delete it under Company Documents and re-upload the file (make sure it’s fully downloaded if it’s in OneDrive/Dropbox first).')
            return
          }
        } catch { /* HEAD check is best-effort — fall through to the real render attempt */ }

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
        console.error('CompanyDocEditor: failed to render PDF', e)
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

  // ── Tap to add (touch-friendly) — drops the field on the page you're viewing ─
  const addField = (type: FieldType) => {
    const isSig = type === 'signature'
    const id = Math.random().toString(36).slice(2)
    setPlacements((p) => [...p, { id, type, page: activePage, x: 50, y: 45, bg: isSig ? 'none' : 'white', size: isSig ? 26 : 15, ...(EDITABLE.includes(type) ? { text: '' } : {}) }])
    setSelectedId(id)
  }

  // Track which page is centred in the viewport so tap-to-add targets it.
  const onScroll = () => {
    const c = scrollRef.current
    if (!c) return
    const mid = c.getBoundingClientRect().top + c.clientHeight / 2
    let best = 1, bestDist = Infinity
    pageRefs.current.forEach((el, idx) => {
      if (!el) return
      const r = el.getBoundingClientRect()
      const d = Math.abs((r.top + r.height / 2) - mid)
      if (d < bestDist) { bestDist = d; best = idx + 1 }
    })
    setActivePage(best)
  }

  // Pinch-to-zoom (two fingers) on the document — plus the +/- buttons.
  const clampZoom = (z: number) => Math.min(3, Math.max(0.5, Math.round(z * 100) / 100))
  const touchDist = (t: React.TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
  const onTouchStart = (e: React.TouchEvent) => { if (e.touches.length === 2) pinch.current = { d0: touchDist(e.touches), z0: zoom } }
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinch.current) setZoom(clampZoom(pinch.current.z0 * (touchDist(e.touches) / (pinch.current.d0 || 1))))
  }
  const onTouchEnd = () => { pinch.current = null }

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
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', stopMove)
  }, [onMove])
  const startMove = (pid: string) => (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    dragging.current = { id: pid }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', stopMove)
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
    window.removeEventListener('pointermove', onResize)
    window.removeEventListener('pointerup', stopResize)
  }, [onResize])
  const startResize = (pid: string, startSize: number) => (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    const box = (e.currentTarget as HTMLElement).parentElement as HTMLElement
    const rect = box.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    resizing.current = { id: pid, cx, cy, startDist: Math.hypot(e.clientX - cx, e.clientY - cy) || 1, startSize }
    window.addEventListener('pointermove', onResize)
    window.addEventListener('pointerup', stopResize)
  }

  // ── Edge (wall) resize — width via left/right, height via top/bottom ─────
  // A box needs BOTH w and h defined before CSS container-query sizing (used to fit the
  // text) can measure it — leaving one axis undefined makes that axis (and the fitted
  // font) collapse to 0, which is what caused fields to vanish or snap to a sliver.
  // So the very first edge drag seeds whichever dimension isn't set yet from the box's
  // current rendered size, and every subsequent drag keeps both dimensions in the update.
  const MIN_PCT = 6
  const edgeResizing = useRef<null | { id: string; edge: 'l' | 'r' | 't' | 'b'; pageRect: DOMRect; x: number; y: number; rightPct: number; seedH: number }>(null)
  const onEdge = useCallback((e: MouseEvent) => {
    const r = edgeResizing.current
    if (!r) return
    const mx = ((e.clientX - r.pageRect.left) / r.pageRect.width) * 100
    const my = ((e.clientY - r.pageRect.top) / r.pageRect.height) * 100
    setPlacements((prev) => prev.map((pl) => {
      if (pl.id !== r.id) return pl
      const h = pl.h ?? r.seedH
      if (r.edge === 'r') return { ...pl, w: Math.min(100, Math.max(MIN_PCT, mx - r.x)), h }
      if (r.edge === 'l') { const nx = Math.min(r.rightPct - MIN_PCT, Math.max(0, mx)); return { ...pl, x: nx, w: Math.max(MIN_PCT, r.rightPct - nx), h } }
      const w = pl.w ?? (r.rightPct - r.x)
      if (r.edge === 'b') return { ...pl, w, h: Math.min(100, Math.max(MIN_PCT, 2 * (my - r.y))) }
      return { ...pl, w, h: Math.min(100, Math.max(MIN_PCT, 2 * (r.y - my))) }
    }))
  }, [])
  const stopEdge = useCallback(() => {
    edgeResizing.current = null
    window.removeEventListener('pointermove', onEdge)
    window.removeEventListener('pointerup', stopEdge)
  }, [onEdge])
  const startEdge = (pl: Placement, edge: 'l' | 'r' | 't' | 'b') => (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    const pageRect = pageRefs.current[pl.page - 1]?.getBoundingClientRect()
    if (!pageRect) return
    const box = (e.currentTarget as HTMLElement).parentElement as HTMLElement
    const brect = box.getBoundingClientRect()
    const startWpct = pl.w ?? Math.max(MIN_PCT, (brect.width / pageRect.width) * 100)
    const startHpct = pl.h ?? Math.max(MIN_PCT, (brect.height / pageRect.height) * 100)
    edgeResizing.current = { id: pl.id, edge, pageRect, x: pl.x, y: pl.y, rightPct: pl.x + startWpct, seedH: startHpct }
    // Seed the placement with both dimensions immediately so the box never renders
    // with only one axis defined, even before the pointer moves.
    setPlacements((prev) => prev.map((p) => (p.id === pl.id ? { ...p, w: p.w ?? startWpct, h: p.h ?? startHpct } : p)))
    window.addEventListener('pointermove', onEdge)
    window.addEventListener('pointerup', stopEdge)
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

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Left: field boxes to add to the document */}
        <div className="w-full lg:w-[340px] flex-shrink-0 border-b lg:border-b-0 lg:border-r border-gray-200 bg-white overflow-y-auto p-4 lg:p-5 space-y-3 lg:space-y-4 max-h-[40vh] lg:max-h-none">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Fields</h3>
            <p className="text-xs text-gray-400 mt-0.5">Type a value, then <span className="font-semibold text-gray-500">tap</span> a field to add it to page {activePage} — or drag it on (desktop).</p>
          </div>
          {(Object.keys(FIELD_META) as FieldType[]).map((type) => {
            const meta = FIELD_META[type]
            const Icon = meta.icon
            return (
              <div key={type} className="rounded-xl border border-gray-200 p-3 space-y-2 bg-gray-50/60">
                <div
                  role="button"
                  tabIndex={0}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.setData('fieldType', type); e.dataTransfer.effectAllowed = 'copy' }}
                  onClick={() => addField(type)}
                  className="flex items-center gap-2 cursor-pointer active:scale-[0.99] rounded-lg bg-[#00250e] text-white px-3 py-2.5 text-sm font-semibold select-none"
                  title="Tap to add — or drag onto the document"
                >
                  <Plus className="w-4 h-4 opacity-80" />
                  <Icon className="w-4 h-4" />
                  {meta.label}
                </div>
                {EDITABLE.includes(type) ? (
                  <p className="text-[11px] text-gray-400 px-0.5">Drag on, then type directly on the document.</p>
                ) : (
                  <input
                    value={values[type as keyof FieldValues]}
                    onChange={(e) => setValues((v) => ({ ...v, [type]: e.target.value }))}
                    placeholder={meta.placeholder}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00250e]/25 focus:border-[#00250e]"
                  />
                )}
              </div>
            )
          })}
          <p className="text-[11px] text-gray-400 leading-relaxed border-t border-gray-100 pt-3">
            Fields drop as a white box so they <span className="font-semibold text-gray-500">cover</span> printed
            placeholders like <span className="font-semibold text-gray-500">$0.00</span>. Tap a placed field to select it, then drag it to
            move, drag the <span className="font-semibold text-gray-500">corners</span> to resize the text, or the
            <span className="font-semibold text-gray-500"> walls</span> to widen/heighten. Changes save automatically.
          </p>
        </div>

        {/* Right: full scrollable + zoomable PDF with drop targets */}
        <div className="flex-1 relative min-h-0">
        <div ref={scrollRef} onScroll={onScroll} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
          className="absolute inset-0 overflow-auto bg-[#E6E8EB] p-4" onPointerDown={() => setSelectedId(null)}>
          {pages.length === 0 && (
            <div className="h-full flex items-center justify-center text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> {loadingMsg}
            </div>
          )}
          <div className="mx-auto space-y-4" style={{ width: `${zoom * 100}%`, maxWidth: zoom > 1 ? 'none' : 720 }}>
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
                    const font = fontForType(pl.type)
                    const selected = selectedId === pl.id
                    const sized = pl.w != null || pl.h != null
                    const displayText = editable ? (pl.text || (pl.type === 'signature' ? 'Signature…' : 'Type…'))
                      : (values[pl.type as keyof FieldValues] || FIELD_META[pl.type].label)
                    return (
                      <div
                        key={pl.id}
                        onPointerDownCapture={() => setSelectedId(pl.id)}
                        style={{ left: `${pl.x}%`, top: `${pl.y}%`, width: pl.w != null ? `${pl.w}%` : undefined, height: pl.h != null ? `${pl.h}%` : undefined }}
                        className="absolute -translate-y-1/2 group"
                      >
                        {/* Control toolbar — stays while selected, or on hover */}
                        <div className={`absolute -top-6 left-0 items-center gap-0.5 bg-gray-900 text-white rounded px-1 py-0.5 shadow-lg z-10 whitespace-nowrap ${selected ? 'flex' : 'hidden group-hover:flex'}`}>
                          <button onPointerDown={startMove(pl.id)} className="p-0.5 cursor-move hover:text-emerald-300 touch-none" aria-label="Move" title="Drag to move"><GripVertical className="w-3.5 h-3.5" /></button>
                          <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); cycleBg(pl.id) }} className="p-0.5 hover:text-emerald-300" aria-label="Background" title="Background: white / dark / none"><Palette className="w-3 h-3" /></button>
                          <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); removePlacement(pl.id) }} className="p-0.5 hover:text-red-400" aria-label="Remove" title="Remove"><X className="w-3 h-3" /></button>
                        </div>
                        {/* The value box that covers the underlying text */}
                        <div
                          onPointerDown={editable ? undefined : startMove(pl.id)}
                          onDoubleClick={editable ? undefined : (e) => { e.stopPropagation(); setEditingId(pl.id) }}
                          style={{ ...boxStyle(bg), ...(sized ? { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' } as React.CSSProperties : {}) }}
                          className={`relative items-center whitespace-nowrap ring-1 ${sized ? 'flex' : 'inline-flex'} ${selected ? 'ring-emerald-400' : 'ring-transparent group-hover:ring-emerald-400/70'} ${editable ? '' : 'cursor-move touch-none'}`}
                        >
                          <FitBox sized={sized} size={size} font={font} text={displayText}>
                            {(fontPx) => editable ? (
                              <input
                                value={pl.text ?? ''}
                                onChange={(e) => updateText(pl.id, e.target.value)}
                                onPointerDown={(e) => e.stopPropagation()}
                                placeholder={pl.type === 'signature' ? 'Signature…' : 'Type…'}
                                size={Math.max(4, (pl.text ?? '').length)}
                                style={{ fontFamily: font, fontSize: fontPx, fontWeight: 400, color: 'inherit', ...(sized ? { width: '100%', textAlign: 'center' } : {}) }}
                                className="bg-transparent outline-none min-w-[2rem]"
                              />
                            ) : editingId === pl.id ? (
                              <input
                                autoFocus
                                value={values[pl.type as keyof FieldValues]}
                                onChange={(e) => setValues((v) => ({ ...v, [pl.type]: e.target.value }))}
                                onPointerDown={(e) => e.stopPropagation()}
                                onBlur={() => setEditingId(null)}
                                onKeyDown={(e) => { if (e.key === 'Enter') setEditingId(null) }}
                                placeholder={FIELD_META[pl.type].placeholder}
                                size={Math.max(4, values[pl.type as keyof FieldValues].length)}
                                style={{ fontFamily: font, fontSize: fontPx, fontWeight: 400, color: 'inherit', ...(sized ? { width: '100%', textAlign: 'center' } : {}) }}
                                className="bg-transparent outline-none min-w-[2rem]"
                              />
                            ) : (
                              <span style={{ fontFamily: font, fontSize: fontPx, fontWeight: 400, color: 'inherit', whiteSpace: 'nowrap' }}>
                                {values[pl.type as keyof FieldValues] || FIELD_META[pl.type].label}
                              </span>
                            )}
                          </FitBox>
                          {selected && [
                            '-top-3 -left-3 cursor-nwse-resize',
                            '-top-3 -right-3 cursor-nesw-resize',
                            '-bottom-3 -left-3 cursor-nesw-resize',
                            '-bottom-3 -right-3 cursor-nwse-resize',
                          ].map((c, idx) => (
                            <span key={idx} onPointerDown={startResize(pl.id, size)}
                              className={`absolute ${c} w-7 h-7 z-10 touch-none flex items-center justify-center`}>
                              <span className="w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full shadow" />
                            </span>
                          ))}
                          {selected && (
                            <>
                              <span onPointerDown={startEdge(pl, 'l')} title="Drag to widen / narrow" className="absolute top-1 bottom-1 -left-1.5 w-3 cursor-ew-resize hover:bg-emerald-400/50 rounded touch-none" />
                              <span onPointerDown={startEdge(pl, 'r')} title="Drag to widen / narrow" className="absolute top-1 bottom-1 -right-1.5 w-3 cursor-ew-resize hover:bg-emerald-400/50 rounded touch-none" />
                              <span onPointerDown={startEdge(pl, 't')} title="Drag to heighten / shorten" className="absolute left-1 right-1 -top-1.5 h-3 cursor-ns-resize hover:bg-emerald-400/50 rounded touch-none" />
                              <span onPointerDown={startEdge(pl, 'b')} title="Drag to heighten / shorten" className="absolute left-1 right-1 -bottom-1.5 h-3 cursor-ns-resize hover:bg-emerald-400/50 rounded touch-none" />
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
        {/* Zoom control — tap +/- (works on iOS) or pinch with two fingers */}
        <div className="absolute bottom-3 right-3 z-20 flex items-center gap-0.5 bg-white rounded-full shadow-lg border border-gray-200 px-1 py-1">
          <button onClick={() => setZoom((z) => clampZoom(z - 0.25))} aria-label="Zoom out" className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600"><ZoomOut className="w-4 h-4" /></button>
          <button onClick={() => setZoom(1)} className="px-2 text-xs font-semibold text-gray-600 tabular-nums min-w-[3.2rem]">{Math.round(zoom * 100)}%</button>
          <button onClick={() => setZoom((z) => clampZoom(z + 0.25))} aria-label="Zoom in" className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600"><ZoomIn className="w-4 h-4" /></button>
        </div>
        </div>
      </div>
    </div>
  )
}
