'use client'

import { useEffect, useState } from 'react'
import { fontFromPdfName, type TemplateFont } from '@/lib/documents/template'

const PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.1.200/legacy/build/pdf.worker.min.mjs'

// A run of real (selectable) text in the PDF — only vector PDFs have these;
// image-only exports (most of ours) come back with none.
export interface TextRun {
  str: string
  x: number; y: number; w: number; h: number   // bbox, pt, top-down
  baseline: number
  size: number
  font: TemplateFont
}

export interface PdfPage {
  src: string              // rendered page image
  w: number; h: number     // page size in pt
  scale: number            // canvas px per pt
  canvas?: HTMLCanvasElement
  runs?: TextRun[]
}

// Renders every page of a PDF to an image. `forSetup` also keeps the canvas
// (for colour sampling) and extracts the text runs with their fonts.
export function usePdfPages(pdfUrl: string, { scale = 1.6, forSetup = false } = {}) {
  const [pages, setPages] = useState<PdfPage[]>([])
  const [message, setMessage] = useState('Loading document…')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        try {
          const head = await fetch(pdfUrl, { method: 'HEAD' })
          if (head.ok && head.headers.get('content-length') === '0') {
            if (!cancelled) setMessage('This document is empty (0 bytes), so the upload didn’t complete. Remove it under Company Documents and upload it again.')
            return
          }
        } catch { /* best-effort */ }

        const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs')
        pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER
        const pdf = await pdfjs.getDocument({ url: pdfUrl }).promise
        if (cancelled) return
        const out: PdfPage[] = []
        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) return
          setMessage(`Rendering page ${i} of ${pdf.numPages}…`)
          const page = await pdf.getPage(i)
          const base = page.getViewport({ scale: 1 })
          const viewport = page.getViewport({ scale })
          const canvas = document.createElement('canvas')
          canvas.width = Math.round(viewport.width)
          canvas.height = Math.round(viewport.height)
          const ctx = canvas.getContext('2d', { willReadFrequently: forSetup })!
          await page.render({ canvasContext: ctx, viewport, canvas }).promise
          const entry: PdfPage = { src: canvas.toDataURL('image/jpeg', 0.88), w: base.width, h: base.height, scale: canvas.width / base.width }
          if (forSetup) {
            entry.canvas = canvas
            entry.runs = await extractRuns(page, base)
          }
          out.push(entry)
          setPages([...out])
        }
        setMessage('')
      } catch (e) {
        console.error('usePdfPages: failed to render PDF', e)
        if (!cancelled) setMessage('Could not render this document.')
      }
    })()
    return () => { cancelled = true }
  }, [pdfUrl, scale, forSetup])

  return { pages, message }
}

async function extractRuns(page: any, viewport: any): Promise<TextRun[]> {
  try {
    const tc = await page.getTextContent()
    const runs: TextRun[] = []
    for (const it of tc.items as any[]) {
      if (!it.str || !it.str.trim()) continue
      const [a, b, , , e, f] = it.transform
      const size = Math.hypot(a, b)
      if (!size) continue
      const style = tc.styles?.[it.fontName] ?? {}
      const ascent = typeof style.ascent === 'number' && style.ascent > 0 ? style.ascent : 0.8
      const descent = typeof style.descent === 'number' ? style.descent : -0.2
      const [bx, by] = viewport.convertToViewportPoint(e, f)
      let fontInfo: any = null
      try { fontInfo = page.commonObjs.get(it.fontName) } catch { /* font not resolved */ }
      runs.push({
        str: it.str,
        x: bx,
        y: by - ascent * size,
        w: it.width,
        h: (ascent - descent) * size,
        baseline: by,
        size,
        font: fontFromPdfName(fontInfo?.name ?? style.fontFamily ?? '', { bold: fontInfo?.bold, italic: fontInfo?.italic, black: fontInfo?.black }),
      })
    }
    return runs
  } catch {
    return []
  }
}
