'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Loader2, Trash2, Eye, EyeOff, Square, MousePointer2, PenLine, Type, AlertCircle } from 'lucide-react'
import {
  FONT_PRESETS, categoryFor, newFieldId, sortFields,
  type DocTemplate, type TemplateField, type TemplateFont,
} from '@/lib/documents/template'
import { saveCompanyDocTemplateAction } from '@/actions/doc-templates'
import { AGREEMENT_KEY_OPTIONS, guessAgreementKey } from '@/lib/documents/quote'
import { usePdfPages, type PdfPage, type TextRun } from './usePdfPages'
import { TemplatePage, useTemplateFonts } from './TemplatePage'

type Rect = { x: number; y: number; w: number; h: number }

const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900]
const input = 'w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00250e]/25 focus:border-[#00250e]'
const small = 'text-[10px] font-semibold uppercase tracking-wider text-gray-400'

export function TemplateSetup({
  companyDocId, name, fileUrl, initial,
}: { companyDocId: string; name: string; fileUrl: string; initial: DocTemplate | null }) {
  const { pages, message } = usePdfPages(fileUrl, { scale: 2, forSetup: true })
  const [fields, setFields] = useState<TemplateField[]>(initial?.fields ?? [])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [redrawId, setRedrawId] = useState<string | null>(null)
  const [showOriginal, setShowOriginal] = useState(false)
  const [drawing, setDrawing] = useState(true)
  const [draft, setDraft] = useState<{ page: number; rect: Rect } | null>(null)
  const [saved, setSaved] = useState<'saved' | 'saving' | 'error'>('saved')
  const [err, setErr] = useState<string | null>(null)
  const drag = useRef<null | { page: number; x0: number; y0: number; el: HTMLDivElement }>(null)
  const firstRun = useRef(true)
  const lastFont = useRef<TemplateFont>(fields[fields.length - 1]?.font ?? { family: 'Arimo', weight: 400, italic: false, category: 'sans' })

  useTemplateFonts(fields)

  // ── Autosave ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return }
    if (!pages.length) return
    setSaved('saving')
    const t = setTimeout(async () => {
      const res = await saveCompanyDocTemplateAction(companyDocId, {
        version: 1, pages: pages.map((p) => ({ w: p.w, h: p.h })), fields,
      })
      if (res?.error) { setSaved('error'); setErr(res.error) } else { setSaved('saved'); setErr(null) }
    }, 800)
    return () => clearTimeout(t)
  }, [fields]) // eslint-disable-line react-hooks/exhaustive-deps

  const update = (id: string, patch: Partial<TemplateField>) =>
    setFields((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  const updateFont = (id: string, patch: Partial<TemplateFont>) =>
    setFields((fs) => fs.map((f) => {
      if (f.id !== id) return f
      const font = { ...f.font, ...patch }
      if (patch.family) font.category = categoryFor(patch.family)
      lastFont.current = font
      return { ...f, font }
    }))
  const remove = (id: string) => { setFields((fs) => fs.filter((f) => f.id !== id)); if (selectedId === id) setSelectedId(null) }

  // ── Drawing a box over the page ─────────────────────────────────────────
  const toPt = (e: React.PointerEvent | PointerEvent, el: HTMLElement, pg: PdfPage) => {
    const r = el.getBoundingClientRect()
    return {
      x: Math.min(pg.w, Math.max(0, ((e.clientX - r.left) / r.width) * pg.w)),
      y: Math.min(pg.h, Math.max(0, ((e.clientY - r.top) / r.height) * pg.h)),
    }
  }
  const onDown = (pageNum: number) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drawing || e.button !== 0) return
    const pg = pages[pageNum - 1]
    const p = toPt(e, e.currentTarget, pg)
    drag.current = { page: pageNum, x0: p.x, y0: p.y, el: e.currentTarget }
    e.currentTarget.setPointerCapture(e.pointerId)
    setDraft({ page: pageNum, rect: { x: p.x, y: p.y, w: 0, h: 0 } })
  }
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    const p = toPt(e, d.el, pages[d.page - 1])
    setDraft({ page: d.page, rect: { x: Math.min(d.x0, p.x), y: Math.min(d.y0, p.y), w: Math.abs(p.x - d.x0), h: Math.abs(p.y - d.y0) } })
  }
  const onUp = () => {
    const d = drag.current
    drag.current = null
    const box = draft
    setDraft(null)
    if (!d || !box) return
    const pg = pages[d.page - 1]
    if (box.rect.w < 3 && box.rect.h < 3) {
      // A click: select a field, or turn a text run into one.
      const hit = fields.find((f) => f.page === d.page && d.x0 >= f.x && d.x0 <= f.x + f.w && d.y0 >= f.y && d.y0 <= f.y + f.h)
      if (hit) { setSelectedId(hit.id); return }
      const run = pg.runs?.find((r) => d.x0 >= r.x && d.x0 <= r.x + r.w && d.y0 >= r.y && d.y0 <= r.y + r.h)
      if (run) addField(fieldFromRun(run, d.page, pg))
      else setSelectedId(null)
      return
    }
    const sampled = sampleBox(pg, box.rect)
    if (redrawId) {
      setFields((fs) => fs.map((f) => (f.id === redrawId ? { ...f, ...box.rect, ...sampled.geometry, page: d.page } : f)))
      setSelectedId(redrawId)
      setRedrawId(null)
      return
    }
    addField({
      id: newFieldId(),
      label: `Field ${fields.length + 1}`,
      kind: 'text',
      page: d.page,
      ...box.rect,
      ...sampled.geometry,
      multiline: sampled.multiline,
      defaultValue: '',
      font: { ...lastFont.current },
      color: sampled.color,
      bg: sampled.bg,
      align: 'left',
      letterSpacing: 0,
      uppercase: false,
      lineHeight: sampled.lineHeight,
    })
  }
  const addField = (f: TemplateField) => { setFields((fs) => [...fs, f]); setSelectedId(f.id) }

  const ordered = sortFields(fields)
  const hasRuns = pages.some((p) => (p.runs?.length ?? 0) > 0)

  return (
    <div className="h-[calc(100dvh-3.5rem)] flex flex-col -m-4 lg:-m-8">
      <div className="flex items-center justify-between gap-3 px-5 h-14 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/documents" className="text-gray-400 hover:text-gray-700"><ArrowLeft className="w-4 h-4" /></Link>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
            <p className="text-[11px] text-gray-400">Template setup · {fields.length} editable {fields.length === 1 ? 'field' : 'fields'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[11px] text-gray-400 inline-flex items-center gap-1">
            {saved === 'saving' ? <><Loader2 className="w-3 h-3 animate-spin" /> Saving…</>
              : saved === 'error' ? <><AlertCircle className="w-3 h-3 text-red-500" /> Not saved</>
              : <><Check className="w-3 h-3 text-emerald-500" /> Saved</>}
          </span>
          <button onClick={() => setShowOriginal((s) => !s)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white border border-gray-200 text-gray-700 hover:border-gray-300 rounded-lg px-3 py-2">
            {showOriginal ? <><EyeOff className="w-3.5 h-3.5" /> Show my fields</> : <><Eye className="w-3.5 h-3.5" /> Show original</>}
          </button>
          <button onClick={() => setDrawing((d) => !d)} className="lg:hidden inline-flex items-center gap-1.5 text-xs font-semibold bg-white border border-gray-200 text-gray-700 rounded-lg px-3 py-2">
            {drawing ? <><MousePointer2 className="w-3.5 h-3.5" /> Scroll</> : <><Square className="w-3.5 h-3.5" /> Draw</>}
          </button>
        </div>
      </div>
      {err && <p className="px-5 py-2 text-xs text-red-600 bg-red-50 border-b border-red-100">{err}</p>}

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        <div className="w-full lg:w-[380px] flex-shrink-0 border-b lg:border-b-0 lg:border-r border-gray-200 bg-white overflow-y-auto p-4 lg:p-5 space-y-3 max-h-[45vh] lg:max-h-none">
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 text-xs text-gray-500 leading-relaxed space-y-1.5">
            <p><span className="font-semibold text-gray-700">Draw a box</span> over any text you want to change on each proposal, like the client name or the price.</p>
            {hasRuns && <p>This PDF has real text, so you can also <span className="font-semibold text-gray-700">click a line of text</span> to pick up its exact font and size.</p>}
            <p>Type what the document says in <span className="font-semibold text-gray-700">Template text</span>, then match the font until it looks the same. Use <span className="font-semibold text-gray-700">Show original</span> to compare.</p>
          </div>

          {ordered.length === 0 && <p className="text-sm text-gray-400 text-center py-6">No fields yet.</p>}

          {ordered.map((f) => {
            const open = selectedId === f.id
            const presetKnown = FONT_PRESETS.some((p) => p.family === f.font.family)
            return (
              <div key={f.id} className={`rounded-xl border ${open ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-gray-200'} bg-white`}>
                <button onClick={() => setSelectedId(open ? null : f.id)} className="w-full flex items-center gap-2 px-3 py-2.5 text-left">
                  {f.kind === 'signature' ? <PenLine className="w-4 h-4 text-amber-600" /> : <Type className="w-4 h-4 text-[#00250e]" />}
                  <span className="text-sm font-semibold text-gray-800 truncate flex-1">{f.label || 'Untitled field'}</span>
                  <span className="text-[11px] text-gray-400">p.{f.page}</span>
                </button>
                {open && (
                  <div className="px-3 pb-3 space-y-2.5 border-t border-gray-100 pt-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="col-span-2 space-y-1"><span className={small}>Label in editor</span>
                        <input className={input} value={f.label} onChange={(e) => update(f.id, { label: e.target.value })} placeholder="e.g. Client name" />
                      </label>
                      <label className="space-y-1"><span className={small}>Type</span>
                        <select className={input} value={f.kind} onChange={(e) => { const kind = e.target.value as TemplateField['kind']; update(f.id, kind === 'signature' ? { kind, bg: 'none', multiline: false } : { kind }) }}>
                          <option value="text">Text</option>
                          <option value="signature">Client signature</option>
                        </select>
                      </label>
                      <label className="space-y-1"><span className={small}>Lines</span>
                        <select className={input} value={f.multiline ? 'multi' : 'single'} onChange={(e) => update(f.id, { multiline: e.target.value === 'multi' })}>
                          <option value="single">Single line</option>
                          <option value="multi">Multiple lines</option>
                        </select>
                      </label>
                    </div>

                    {f.kind === 'text' && (
                      <>
                        <label className="block space-y-1"><span className={small}>Template text (what the document says here)</span>
                          {f.multiline
                            ? <textarea rows={3} className={input} value={f.defaultValue} onChange={(e) => update(f.id, { defaultValue: e.target.value })} />
                            : <input className={input} value={f.defaultValue} onChange={(e) => update(f.id, { defaultValue: e.target.value })} placeholder="e.g. Name" />}
                        </label>
                        <label className="block space-y-1"><span className={small}>On the service agreement (when a quote is accepted)</span>
                          <select className={input} value={f.agreementKey ?? ''} onChange={(e) => update(f.id, { agreementKey: e.target.value || undefined })}>
                            {AGREEMENT_KEY_OPTIONS.map((o) => {
                              const guess = o.value === '' ? guessAgreementKey(f.label) : null
                              const guessLabel = guess ? AGREEMENT_KEY_OPTIONS.find((x) => x.value === guess)?.label : null
                              return <option key={o.value} value={o.value}>{o.value === '' ? `${o.label}${guessLabel ? ` (${guessLabel})` : ' (nothing)'}` : o.label}</option>
                            })}
                          </select>
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="col-span-2 space-y-1"><span className={small}>Font</span>
                            <select className={input} value={presetKnown ? f.font.family : '__custom'}
                              onChange={(e) => { if (e.target.value !== '__custom') updateFont(f.id, { family: e.target.value }) }}>
                              {FONT_PRESETS.filter((p) => p.category !== 'script').map((p) => (
                                <option key={p.family} value={p.family}>{p.family}{p.note ? ` (${p.note})` : ''}</option>
                              ))}
                              <option value="__custom">Other Google font…</option>
                            </select>
                            {!presetKnown && (
                              <input className={input} value={f.font.family} onChange={(e) => updateFont(f.id, { family: e.target.value })} placeholder="Google font name" />
                            )}
                          </label>
                          <label className="space-y-1"><span className={small}>Size (pt)</span>
                            <input type="number" step={0.5} min={4} max={200} className={input} value={f.size}
                              onChange={(e) => update(f.id, { size: Math.max(1, Number(e.target.value) || f.size) })} />
                          </label>
                          <label className="space-y-1"><span className={small}>Weight</span>
                            <select className={input} value={f.font.weight} onChange={(e) => updateFont(f.id, { weight: Number(e.target.value) })}>
                              {WEIGHTS.map((w) => <option key={w} value={w}>{w}{w === 400 ? ' regular' : w === 700 ? ' bold' : ''}</option>)}
                            </select>
                          </label>
                          <label className="space-y-1"><span className={small}>Text colour</span>
                            <input type="color" className="w-full h-9 rounded-lg border border-gray-200 cursor-pointer" value={f.color} onChange={(e) => update(f.id, { color: e.target.value })} />
                          </label>
                          <label className="space-y-1"><span className={small}>Cover colour</span>
                            <div className="flex items-center gap-1.5">
                              <input type="color" disabled={f.bg === 'none'} className="flex-1 h-9 rounded-lg border border-gray-200 cursor-pointer disabled:opacity-40" value={f.bg === 'none' ? '#ffffff' : f.bg} onChange={(e) => update(f.id, { bg: e.target.value })} />
                              <label className="text-[11px] text-gray-500 inline-flex items-center gap-1">
                                <input type="checkbox" checked={f.bg === 'none'} onChange={(e) => update(f.id, { bg: e.target.checked ? 'none' : '#ffffff' })} /> None
                              </label>
                            </div>
                          </label>
                          <label className="space-y-1"><span className={small}>Align</span>
                            <select className={input} value={f.align} onChange={(e) => update(f.id, { align: e.target.value as TemplateField['align'] })}>
                              <option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option>
                            </select>
                          </label>
                          <label className="space-y-1"><span className={small}>Letter spacing</span>
                            <input type="number" step={0.01} className={input} value={f.letterSpacing}
                              onChange={(e) => update(f.id, { letterSpacing: Number(e.target.value) || 0 })} />
                          </label>
                          {f.multiline && (
                            <label className="space-y-1"><span className={small}>Line height</span>
                              <input type="number" step={0.05} min={0.8} className={input} value={f.lineHeight}
                                onChange={(e) => update(f.id, { lineHeight: Number(e.target.value) || 1.2 })} />
                            </label>
                          )}
                          <div className="col-span-2 flex items-center gap-4 text-xs text-gray-600">
                            <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={f.font.italic} onChange={(e) => updateFont(f.id, { italic: e.target.checked })} /> Italic</label>
                            <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={f.uppercase} onChange={(e) => update(f.id, { uppercase: e.target.checked })} /> ALL CAPS</label>
                          </div>
                          <div className="col-span-2 grid grid-cols-2 gap-2">
                            <label className="space-y-1"><span className={small}>Text starts at (pt)</span>
                              <input type="number" step={0.5} className={input} value={round(f.tx)} onChange={(e) => update(f.id, { tx: Number(e.target.value) || 0 })} />
                            </label>
                            <label className="space-y-1"><span className={small}>Baseline at (pt)</span>
                              <input type="number" step={0.5} className={input} value={round(f.baseline)} onChange={(e) => update(f.id, { baseline: Number(e.target.value) || 0 })} />
                            </label>
                          </div>
                        </div>
                      </>
                    )}
                    {f.kind === 'signature' && (
                      <p className="text-[11px] text-gray-500">Your client types their signature here when you send the document to sign.</p>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <button onClick={() => setRedrawId(redrawId === f.id ? null : f.id)}
                        className={`text-xs font-semibold rounded-lg px-3 py-1.5 border ${redrawId === f.id ? 'bg-amber-50 border-amber-300 text-amber-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                        {redrawId === f.id ? 'Now draw the new box…' : 'Redraw box'}
                      </button>
                      <button onClick={() => remove(f.id)} className="inline-flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex-1 relative min-h-0">
          <div className="absolute inset-0 overflow-auto bg-[#E6E8EB] p-4">
            {pages.length === 0 && (
              <div className="h-full flex items-center justify-center text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> {message}
              </div>
            )}
            <div className="mx-auto space-y-4 max-w-[820px]">
              {pages.map((pg, i) => (
                <div key={i}
                  onPointerDown={onDown(i + 1)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
                  className={drawing ? 'touch-none cursor-crosshair' : ''}>
                  <TemplatePage
                    page={pg}
                    pageNum={i + 1}
                    fields={showOriginal ? [] : fields}
                    values={{}}
                    force
                    highlightId={selectedId}
                  >
                    <svg viewBox={`0 0 ${pg.w} ${pg.h}`} className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
                      {showOriginal && fields.filter((f) => f.page === i + 1).map((f) => (
                        <rect key={f.id} x={f.x} y={f.y} width={f.w} height={f.h} fill="none" stroke={selectedId === f.id ? '#10b981' : '#94a3b8'} strokeWidth={0.8} strokeDasharray="3 2" />
                      ))}
                      {!showOriginal && fields.filter((f) => f.page === i + 1 && f.id !== selectedId).map((f) => (
                        <rect key={f.id} x={f.x} y={f.y} width={f.w} height={f.h} fill="none" stroke="#10b981" strokeOpacity={0.35} strokeWidth={0.6} />
                      ))}
                      {pg.runs?.filter((r) => !fields.some((f) => f.page === i + 1 && r.x >= f.x - 1 && r.x <= f.x + f.w && r.baseline >= f.y && r.baseline <= f.y + f.h + 1)).map((r, k) => (
                        <rect key={k} x={r.x} y={r.y} width={r.w} height={r.h} fill="#3b82f6" fillOpacity={0.06} />
                      ))}
                      {draft?.page === i + 1 && (
                        <rect x={draft.rect.x} y={draft.rect.y} width={draft.rect.w} height={draft.rect.h} fill="#10b981" fillOpacity={0.12} stroke="#10b981" strokeWidth={1} />
                      )}
                    </svg>
                  </TemplatePage>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const round = (n: number) => Math.round(n * 10) / 10

// ─── Reading the page pixels ──────────────────────────────────────────────────

function hex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
}

function fieldFromRun(run: TextRun, page: number, pg: PdfPage): TemplateField {
  const rect = { x: run.x - 1.5, y: run.y - 1, w: run.w + 3, h: run.h + 2 }
  const { bg, color } = sampleBox(pg, rect)
  return {
    id: newFieldId(),
    label: run.str.trim().slice(0, 40),
    kind: 'text',
    multiline: false,
    page,
    ...rect,
    tx: run.x, tw: run.w, baseline: run.baseline,
    defaultValue: run.str,
    font: run.font,
    size: round(run.size),
    color, bg,
    align: 'left',
    letterSpacing: 0,
    uppercase: false,
    lineHeight: 1.2,
  }
}

// Works out, from the rendered pixels inside a box: the background colour (to
// cover the old text with), the text colour, where the text starts, its
// baseline and roughly what size it is.
function sampleBox(pg: PdfPage, rect: Rect) {
  const fallback = {
    bg: '#ffffff', color: '#111827', multiline: false, lineHeight: 1.2,
    geometry: { tx: rect.x, tw: rect.w, baseline: rect.y + rect.h * 0.78, size: round(Math.max(6, rect.h * 0.7)) },
  }
  const ctx = pg.canvas?.getContext('2d', { willReadFrequently: true })
  if (!ctx) return fallback
  const s = pg.scale
  const px = Math.max(0, Math.floor(rect.x * s)), py = Math.max(0, Math.floor(rect.y * s))
  const pw = Math.max(1, Math.min(pg.canvas!.width - px, Math.ceil(rect.w * s)))
  const ph = Math.max(1, Math.min(pg.canvas!.height - py, Math.ceil(rect.h * s)))
  const data = ctx.getImageData(px, py, pw, ph).data
  const at = (x: number, y: number) => { const i = (y * pw + x) * 4; return [data[i], data[i + 1], data[i + 2]] }

  // Background = most common colour around the edge of the box.
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>()
  const edge = Math.max(1, Math.round(Math.min(pw, ph) * 0.08))
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
    if (x >= edge && x < pw - edge && y >= edge && y < ph - edge) continue
    const [r, g, b] = at(x, y)
    const k = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)
    const e = buckets.get(k) ?? { n: 0, r: 0, g: 0, b: 0 }
    e.n++; e.r += r; e.g += g; e.b += b
    buckets.set(k, e)
  }
  let best = { n: 0, r: 255, g: 255, b: 255 }
  buckets.forEach((e) => { if (e.n > best.n) best = e })
  const bg = [best.r / best.n, best.g / best.n, best.b / best.n]
  const dist = (c: number[]) => Math.hypot(c[0] - bg[0], c[1] - bg[1], c[2] - bg[2])

  // Ink = pixels clearly different from the background.
  let maxD = 0
  const rows = new Array(ph).fill(0)
  let left = pw, right = -1
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
    const d = dist(at(x, y))
    if (d > maxD) maxD = d
    if (d > 70) { rows[y]++; if (x < left) left = x; if (x > right) right = x }
  }
  const bgHex = hex(bg[0], bg[1], bg[2])
  if (right < 0) return { ...fallback, bg: bgHex }

  // Text colour = average of the strongest ink (skips anti-aliased edges).
  let tr = 0, tg = 0, tb = 0, tn = 0
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
    const c = at(x, y)
    if (dist(c) >= maxD * 0.8) { tr += c[0]; tg += c[1]; tb += c[2]; tn++ }
  }

  // Lines of text = runs of rows with ink.
  const lines: { top: number; bottom: number; peak: number }[] = []
  let cur: { top: number; bottom: number; peak: number } | null = null
  for (let y = 0; y < ph; y++) {
    if (rows[y] > 0) {
      if (!cur) cur = { top: y, bottom: y, peak: rows[y] }
      else { cur.bottom = y; cur.peak = Math.max(cur.peak, rows[y]) }
    } else if (cur && y - cur.bottom > Math.max(2, s * 1.5)) { lines.push(cur); cur = null }
  }
  if (cur) lines.push(cur)
  const first = lines[0]
  // Baseline = last row of the first line that still carries a good share of
  // ink; the thin rows below it are descenders (g, p, y).
  let base = first.bottom
  for (let y = first.bottom; y >= first.top; y--) { if (rows[y] >= first.peak * 0.22) { base = y; break } }
  const inkH = (base - first.top + 1) / s
  const size = round(Math.max(4, inkH / 0.72))
  const lineHeight = lines.length > 1 ? Math.max(0.9, Math.round(((lines[1].top - first.top) / s / size) * 100) / 100) : 1.2

  return {
    bg: bgHex,
    color: tn ? hex(tr / tn, tg / tn, tb / tn) : '#111827',
    multiline: lines.length > 1,
    lineHeight,
    geometry: { tx: (px + left) / s, tw: (right - left + 1) / s, baseline: (py + base + 1) / s, size },
  }
}
