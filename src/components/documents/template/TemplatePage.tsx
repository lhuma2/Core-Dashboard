'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  SIGNATURE_FONT, anchorX, displayLines, fieldValue, fontStack, googleFontHref, isChanged,
  type TemplateField, type TemplateFont,
} from '@/lib/documents/template'
import type { PdfPage } from './usePdfPages'

// Adds a Google Fonts stylesheet for every font the fields use (once per page load).
export function useTemplateFonts(fields: TemplateField[]) {
  const key = fields.map((f) => `${f.font.family}|${f.font.weight}|${f.font.italic}`).join(',')
  useEffect(() => {
    const fonts: Pick<TemplateFont, 'family' | 'weight' | 'italic'>[] = [SIGNATURE_FONT, ...fields.map((f) => f.font)]
    for (const f of fonts) {
      if (!f.family.trim()) continue
      const href = googleFontHref(f)
      if (document.querySelector(`link[data-template-font="${CSS.escape(href)}"]`)) continue
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = href
      link.dataset.templateFont = href
      document.head.appendChild(link)
    }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
}

// The text a field shows, drawn in PDF points so it lines up exactly with the
// page image underneath. `force` draws even an unchanged field (setup preview).
export function FieldText({ f, value, force }: { f: TemplateField; value: string; force?: boolean }) {
  const show = force || isChanged(f, value)
  const textRef = useRef<SVGTextElement>(null)
  // Horizontal extent of the drawn text, so the cover also hides any of the
  // original that a longer replacement runs over.
  const [span, setSpan] = useState<{ x0: number; x1: number } | null>(null)
  const font = f.kind === 'signature' ? SIGNATURE_FONT : f.font
  useLayoutEffect(() => {
    if (!show) return
    let alive = true
    const measure = () => {
      const el = textRef.current
      if (!el || !alive) return
      try { const b = el.getBBox(); setSpan({ x0: b.x, x1: b.x + b.width }) } catch { /* not rendered */ }
    }
    measure()
    document.fonts?.ready.then(measure)
    const t = setTimeout(measure, 800)
    return () => { alive = false; clearTimeout(t) }
  }, [show, value, f.size, f.letterSpacing, f.align, f.tx, f.tw, font.family, font.weight, font.italic, f.uppercase])
  if (!show) return null
  const lines = displayLines(f, value)
  const anchor = f.align === 'center' ? 'middle' : f.align === 'right' ? 'end' : 'start'
  const x = anchorX(f)
  const pad = f.size * 0.12
  const coverX0 = span ? Math.min(f.x, span.x0 - pad) : f.x
  const coverX1 = span ? Math.max(f.x + f.w, span.x1 + pad) : f.x + f.w
  return (
    <g>
      {f.bg !== 'none' && <rect x={coverX0} y={f.y} width={coverX1 - coverX0} height={f.h} fill={f.bg} />}
      <text
        ref={textRef}
        x={x}
        y={f.baseline}
        fill={f.color}
        fontFamily={fontStack(font)}
        fontSize={f.size}
        fontWeight={font.weight}
        fontStyle={font.italic ? 'italic' : 'normal'}
        letterSpacing={f.letterSpacing ? `${f.letterSpacing}em` : undefined}
        textAnchor={anchor}
        xmlSpace="preserve"
        style={{ whiteSpace: 'pre' }}
      >
        {lines.map((line, i) => (
          <tspan key={i} x={x} dy={i === 0 ? 0 : f.size * f.lineHeight}>{line || ' '}</tspan>
        ))}
      </text>
    </g>
  )
}

export function TemplatePage({
  page, pageNum, fields, values, signatures, highlightId, force, onFieldClick, children, pageRef,
}: {
  page: PdfPage
  pageNum: number
  fields: TemplateField[]
  values: Record<string, string>
  signatures?: Record<string, string>
  highlightId?: string | null
  force?: boolean
  onFieldClick?: (id: string) => void
  children?: React.ReactNode
  pageRef?: (el: HTMLDivElement | null) => void
}) {
  const onPage = fields.filter((f) => f.page === pageNum)
  return (
    <div ref={pageRef} className="relative bg-white shadow-md w-full select-none" style={{ aspectRatio: `${page.w} / ${page.h}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={page.src} alt={`Page ${pageNum}`} className="absolute inset-0 w-full h-full" draggable={false} />
      <svg viewBox={`0 0 ${page.w} ${page.h}`} className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        {onPage.map((f) => f.kind === 'signature'
          ? <FieldText key={f.id} f={{ ...f, defaultValue: '' }} value={signatures?.[f.id] ?? ''} />
          : <FieldText key={f.id} f={f} value={fieldValue(f, values)} force={force} />)}
        {onPage.map((f) => (
          <rect
            key={`hit-${f.id}`}
            x={f.x - 2} y={f.y - 2} width={f.w + 4} height={f.h + 4} rx={3}
            fill="transparent"
            stroke={highlightId === f.id ? '#10b981' : f.kind === 'signature' && !signatures?.[f.id] ? '#f59e0b' : 'transparent'}
            strokeWidth={1.2}
            strokeDasharray={f.kind === 'signature' && highlightId !== f.id ? '4 3' : undefined}
            className={onFieldClick ? 'cursor-pointer hover:stroke-emerald-400/70' : ''}
            style={{ pointerEvents: onFieldClick ? 'all' : 'none' }}
            onClick={onFieldClick ? (e) => { e.stopPropagation(); onFieldClick(f.id) } : undefined}
          />
        ))}
      </svg>
      {children}
    </div>
  )
}
