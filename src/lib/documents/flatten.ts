// Bakes a company document's placed fields (client name, price, date, typed
// text, typed signature) permanently into the original uploaded PDF, so the
// download is a real standalone file rather than a link to the blank template.
//
// Mirrors the on-screen geometry in CompanyDocEditor.tsx: x/y are a percentage
// of the page, anchoring the box's LEFT edge and VERTICAL CENTER (the editor's
// box uses `-translate-y-1/2`, never `-translate-x`). When w/h are set the box
// has a fixed size and the text is centred within it and fitted to fill it;
// otherwise the text sits at its stored font size, left-anchored at x.
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib'

export type FlattenPlacementType = 'clientName' | 'quotedPrice' | 'date' | 'text' | 'signature'

export interface FlattenPlacement {
  type: FlattenPlacementType
  page: number
  x: number
  y: number
  w?: number
  h?: number
  text?: string
  bg?: 'white' | 'dark' | 'none'
  size?: number
}

export interface FlattenFieldValues {
  clientName?: string
  quotedPrice?: string
  date?: string
}

const WHITE = rgb(1, 1, 1)
const DARK_BG = rgb(0 / 255, 37 / 255, 14 / 255)     // #00250e — matches boxStyle('dark')
const DARK_TEXT = rgb(17 / 255, 24 / 255, 39 / 255)  // #111827 — matches boxStyle('white'/'none')

export async function flattenCompanyDocument(
  originalPdf: Uint8Array | ArrayBuffer,
  placements: FlattenPlacement[],
  fieldValues: FlattenFieldValues,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalPdf)

  const fonts: Record<FlattenPlacementType, PDFFont> = {
    text: await pdfDoc.embedFont(StandardFonts.Helvetica),
    date: await pdfDoc.embedFont(StandardFonts.Helvetica),
    clientName: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    quotedPrice: await pdfDoc.embedFont(StandardFonts.TimesRoman),
    // No cursive font is embedded in this app — italic is the closest built-in
    // approximation of the on-screen script font for a typed signature.
    signature: await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
  }

  const pages = pdfDoc.getPages()

  for (const pl of placements) {
    const page = pages[pl.page - 1]
    if (!page) continue

    const value = (pl.type === 'text' || pl.type === 'signature' ? pl.text : fieldValues[pl.type]) ?? ''
    if (!value.trim()) continue // don't bake in an unfilled placeholder label

    const font = fonts[pl.type] ?? fonts.text
    const { width: pageW, height: pageH } = page.getSize()

    const leftTd = (pl.x / 100) * pageW        // top-down left edge, in points
    const centerYTd = (pl.y / 100) * pageH     // top-down vertical center, in points
    const sized = pl.w != null || pl.h != null
    const boxW = pl.w != null ? (pl.w / 100) * pageW : undefined
    const boxH = pl.h != null ? (pl.h / 100) * pageH : undefined

    // Font size: a sized box fits its text to fill it (same rule as the live
    // editor's FitBox); an unsized box uses the stored px size, which was
    // calibrated against the on-screen preview rendered at a fixed 1.4x scale
    // (1 preview px == 1/1.4 PDF point, independent of page size or zoom).
    let fontSize: number
    if (sized && boxW && boxH) {
      fontSize = Math.min(boxH * 0.72, boxW * 0.22)
      const measuredWidth = font.widthOfTextAtSize(value, fontSize)
      if (measuredWidth > boxW) fontSize *= (boxW / measuredWidth) * 0.94
      fontSize = Math.max(4, fontSize)
    } else {
      fontSize = (pl.size ?? 15) / 1.4
    }

    const textWidth = font.widthOfTextAtSize(value, fontSize)
    const textLeftTd = sized && boxW ? leftTd + (boxW - textWidth) / 2 : leftTd
    // Baseline sits below the visual vertical center by ~0.35em, which is a
    // standard approximation for centering a single line of text on a point.
    const baselineYTd = centerYTd + fontSize * 0.35

    if (pl.bg === 'white' || pl.bg === 'dark') {
      const pad = 3
      const rectW = sized && boxW ? boxW : textWidth + pad * 2
      const rectH = sized && boxH ? boxH : fontSize * 1.35
      const rectLeftTd = sized && boxW ? leftTd : textLeftTd - pad
      const rectTopTd = sized && boxH ? centerYTd - boxH / 2 : baselineYTd - fontSize * 1.05
      page.drawRectangle({
        x: rectLeftTd,
        y: pageH - rectTopTd - rectH,
        width: rectW,
        height: rectH,
        color: pl.bg === 'white' ? WHITE : DARK_BG,
      })
    }

    page.drawText(value, {
      x: textLeftTd,
      y: pageH - baselineYTd,
      size: fontSize,
      font,
      color: pl.bg === 'dark' ? WHITE : DARK_TEXT,
    })
  }

  return pdfDoc.save()
}
