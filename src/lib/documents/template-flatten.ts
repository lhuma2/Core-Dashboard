// Bakes a template document's edited fields into the original PDF: covers the
// template's text with the field's background colour and draws the new text
// with the same Google font the editor previews, at the same baseline. Mirrors
// FieldText in components/documents/template/TemplatePage.tsx.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import {
  SIGNATURE_FONT, anchorX, displayLines, fieldValue, googleFontHref, isChanged,
  type TemplateDocData, type TemplateField, type TemplateFont,
} from './template'

const fileCache = new Map<string, Promise<Uint8Array | null>>()

// Fetches a font file from Google Fonts. `text` asks Google for a font cut down
// to just those characters.
function fetchFontFile(font: TemplateFont, text?: string): Promise<Uint8Array | null> {
  const key = `${font.family}|${font.weight}|${font.italic}|${text ?? ''}`
  let p = fileCache.get(key)
  if (!p) {
    const suffix = text ? `&text=${encodeURIComponent(text)}` : ''
    const load = async (href: string) => {
      const css = await fetch(href + suffix, { cache: 'force-cache' })
      if (!css.ok) return null
      const url = (await css.text()).match(/url\((https:[^)]+)\)/)?.[1]
      if (!url) return null
      const res = await fetch(url, { cache: 'force-cache' })
      return res.ok ? new Uint8Array(await res.arrayBuffer()) : null
    }
    p = (async () => {
      try {
        return (await load(googleFontHref(font)))
          // The family may not ship that exact weight/style, so fall back to its default.
          ?? (await load(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(font.family.trim()).replace(/%20/g, '+')}`))
      } catch {
        return null
      }
    })()
    fileCache.set(key, p)
  }
  return p
}

// fontkit can't read every Google font file: some throw when embedded whole,
// some only as Google's own per-text cut, and its own subsetter can silently
// drop glyphs. So try the ways that fail loudly first, proving each one in a
// scratch document (embedding is lazy, so problems only show on save).
async function embedMatchingFont(pdfDoc: PDFDocument, font: TemplateFont, text: string): Promise<PDFFont> {
  const attempts: [() => Promise<Uint8Array | null>, boolean][] = [
    [() => fetchFontFile(font), false],
    [() => fetchFontFile(font, text), false],
    [() => fetchFontFile(font), true],
  ]
  for (const [get, subset] of attempts) {
    const bytes = await get()
    if (!bytes) continue
    try {
      const probe = await PDFDocument.create()
      probe.registerFontkit(fontkit)
      const pf = await probe.embedFont(bytes, { subset })
      probe.addPage().drawText(text || 'A', { font: pf, size: 10 })
      await probe.save()
      return await pdfDoc.embedFont(bytes, { subset })
    } catch { /* next way */ }
  }
  return pdfDoc.embedFont(standardFontFor(font))
}

function standardFontFor(font: TemplateFont): StandardFonts {
  const bold = font.weight >= 600
  if (font.category === 'serif') return bold ? (font.italic ? StandardFonts.TimesRomanBoldItalic : StandardFonts.TimesRomanBold) : (font.italic ? StandardFonts.TimesRomanItalic : StandardFonts.TimesRoman)
  if (font.category === 'mono') return bold ? (font.italic ? StandardFonts.CourierBoldOblique : StandardFonts.CourierBold) : (font.italic ? StandardFonts.CourierOblique : StandardFonts.Courier)
  if (font.category === 'script') return StandardFonts.HelveticaOblique
  return bold ? (font.italic ? StandardFonts.HelveticaBoldOblique : StandardFonts.HelveticaBold) : (font.italic ? StandardFonts.HelveticaOblique : StandardFonts.Helvetica)
}

function hexToRgb(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
  const n = m ? parseInt(m[1], 16) : 0x111827
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

// Standard fonts only cover WinAnsi; strip what they can't draw rather than fail.
function safeFor(font: PDFFont, text: string): string {
  try { font.encodeText(text); return text } catch { /* fall through */ }
  return Array.from(text).filter((ch) => { try { font.encodeText(ch); return true } catch { return false } }).join('')
}

function lineWidth(font: PDFFont, text: string, size: number, spacingPt: number) {
  const chars = Array.from(text)
  return font.widthOfTextAtSize(text, size) + spacingPt * Math.max(0, chars.length - 1)
}

function drawLine(page: PDFPage, font: PDFFont, text: string, x: number, y: number, size: number, spacingPt: number, color: ReturnType<typeof rgb>) {
  if (!spacingPt) { page.drawText(text, { x, y, size, font, color }); return }
  let cx = x
  for (const ch of Array.from(text)) {
    page.drawText(ch, { x: cx, y, size, font, color })
    cx += font.widthOfTextAtSize(ch, size) + spacingPt
  }
}

export async function flattenTemplateDocument(originalPdf: Uint8Array | ArrayBuffer, data: TemplateDocData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalPdf)
  pdfDoc.registerFontkit(fontkit)
  const pages = pdfDoc.getPages()
  const draws: { f: TemplateField; value: string }[] = []
  for (const f of data.template.fields) {
    if (f.kind === 'signature') {
      const sig = data.signatures?.[f.id]
      if (sig && sig.trim()) draws.push({ f: { ...f, defaultValue: '' }, value: sig.trim() })
      continue
    }
    const value = fieldValue(f, data.values)
    if (isChanged(f, value)) draws.push({ f, value })
  }

  // One embedded font per family/weight/style, knowing all the text it has to draw.
  const fontKey = (font: TemplateFont) => `${font.family}|${font.weight}|${font.italic}`
  const fontFor = (f: TemplateField) => (f.kind === 'signature' ? SIGNATURE_FONT : f.font)
  const textByFont = new Map<string, { font: TemplateFont; chars: Set<string> }>()
  for (const { f, value } of draws) {
    const font = fontFor(f)
    const entry = textByFont.get(fontKey(font)) ?? { font, chars: new Set<string>() }
    for (const ch of Array.from(displayLines(f, value).join(''))) entry.chars.add(ch)
    textByFont.set(fontKey(font), entry)
  }
  const fonts = new Map<string, PDFFont>()
  for (const [key, { font, chars }] of Array.from(textByFont.entries())) {
    fonts.set(key, await embedMatchingFont(pdfDoc, font, Array.from(chars).join('')))
  }

  for (const { f, value } of draws) {
    const page = pages[f.page - 1]
    if (!page) continue
    const box = page.getCropBox()
    const toX = (x: number) => box.x + x
    const toY = (yTopDown: number) => box.y + box.height - yTopDown

    const font = fonts.get(fontKey(fontFor(f)))!
    const color = hexToRgb(f.color)
    const spacing = (f.letterSpacing || 0) * f.size
    const ax = anchorX(f)
    const lines = displayLines(f, value).map((raw) => {
      const text = safeFor(font, raw)
      const width = lineWidth(font, text, f.size, spacing)
      const startX = f.align === 'center' ? ax - width / 2 : f.align === 'right' ? ax - width : ax
      return { text, width, startX }
    })

    // Cover the template's text, widened to any part of it a longer value runs over.
    if (f.bg !== 'none') {
      const pad = f.size * 0.12
      const drawn = lines.filter((l) => l.text)
      const x0 = Math.min(f.x, ...drawn.map((l) => l.startX - pad))
      const x1 = Math.max(f.x + f.w, ...drawn.map((l) => l.startX + l.width + pad))
      page.drawRectangle({ x: toX(x0), y: toY(f.y + f.h), width: x1 - x0, height: f.h, color: hexToRgb(f.bg) })
    }

    lines.forEach((l, i) => {
      if (!l.text) return
      drawLine(page, font, l.text, toX(l.startX), toY(f.baseline + i * f.size * f.lineHeight), f.size, spacing, color)
    })
  }

  return pdfDoc.save()
}
