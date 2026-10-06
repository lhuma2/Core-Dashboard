// Company-document templates: an uploaded PDF plus a list of editable fields.
//
// A field is a spot on the page (usually covering some printed text like "Name"
// or "$0.00") that becomes a text box in the proposal editor. When its value is
// changed from the template's own text, the original is covered with the field's
// background colour and the new text is drawn in the field's font, size, weight
// and colour, at the original baseline — so edits read as part of the document.
//
// All geometry is in PDF points at scale 1, measured top-down from the page's
// top-left corner (the same space as pdfjs' `getViewport({ scale: 1 })`).
// Shared by the setup screen, the proposal editor, the signing page and the
// server-side PDF flattener.

export type FontCategory = 'sans' | 'serif' | 'mono' | 'script'
export type FieldAlign = 'left' | 'center' | 'right'

export interface TemplateFont {
  family: string      // Google Fonts family name, e.g. "Poppins"
  weight: number      // 100–900
  italic: boolean
  category: FontCategory
}

export interface TemplateField {
  id: string
  label: string                 // shown above the text box in the editor
  kind: 'text' | 'signature'    // signature = filled in by the recipient when signing
  multiline: boolean
  page: number                  // 1-based
  // Cover box — hides the original printed text when the value changes.
  x: number; y: number; w: number; h: number
  // Text anchor: where the original text starts, its width and its baseline.
  tx: number; tw: number; baseline: number
  defaultValue: string          // the template's own text in this spot
  font: TemplateFont
  size: number                  // pt
  color: string                 // #rrggbb
  bg: string                    // #rrggbb, or 'none' to draw without a cover
  align: FieldAlign
  letterSpacing: number         // em
  uppercase: boolean
  lineHeight: number            // multiple of size, for multi-line values
  // Quotes: which service-agreement particular this field fills when the
  // client accepts (see lib/documents/quote.ts). Unset = guessed from the label.
  agreementKey?: string
}

export interface DocTemplate {
  version: 1
  pages: { w: number; h: number }[]
  fields: TemplateField[]
}

// What a proposal made from a template stores in proposal_documents.data.
export interface TemplateDocData {
  clientName: string
  refNumber?: string
  templateId: string
  templateName: string
  template: DocTemplate          // snapshot, so later template edits don't move existing documents
  values: Record<string, string>
  signatures?: Record<string, string>
  // Quote flow (sent with "Send quote"): the client accepts on /quote/<code>,
  // which issues a prefilled service agreement for them to sign.
  clientType?: 'commercial' | 'residential' | 'end_of_lease'
  quoteMode?: boolean
  acceptedAt?: string
}

export function isTemplateDocData(data: any): data is TemplateDocData {
  return !!data && Array.isArray(data?.template?.fields)
}

export function hasTemplate(t: any): t is DocTemplate {
  return !!t && Array.isArray(t.fields) && t.fields.length > 0
}

// ─── Fonts ────────────────────────────────────────────────────────────────────

export const FONT_PRESETS: { family: string; category: FontCategory; note?: string }[] = [
  { family: 'Arimo', category: 'sans', note: 'Arial / Helvetica' },
  { family: 'Poppins', category: 'sans' },
  { family: 'Montserrat', category: 'sans' },
  { family: 'Inter', category: 'sans' },
  { family: 'DM Sans', category: 'sans' },
  { family: 'Manrope', category: 'sans' },
  { family: 'Space Grotesk', category: 'sans' },
  { family: 'Open Sans', category: 'sans' },
  { family: 'Roboto', category: 'sans' },
  { family: 'Lato', category: 'sans' },
  { family: 'Raleway', category: 'sans' },
  { family: 'Work Sans', category: 'sans' },
  { family: 'Carlito', category: 'sans', note: 'Calibri' },
  { family: 'Tinos', category: 'serif', note: 'Times New Roman' },
  { family: 'Playfair Display', category: 'serif' },
  { family: 'Fraunces', category: 'serif' },
  { family: 'Newsreader', category: 'serif' },
  { family: 'Source Serif 4', category: 'serif' },
  { family: 'Lora', category: 'serif' },
  { family: 'Merriweather', category: 'serif' },
  { family: 'Libre Baskerville', category: 'serif' },
  { family: 'EB Garamond', category: 'serif' },
  { family: 'Cormorant Garamond', category: 'serif' },
  { family: 'Gelasio', category: 'serif', note: 'Georgia' },
  { family: 'Caladea', category: 'serif', note: 'Cambria' },
  { family: 'Cousine', category: 'mono', note: 'Courier New' },
  { family: 'IBM Plex Mono', category: 'mono' },
  { family: 'Dancing Script', category: 'script' },
  { family: 'Great Vibes', category: 'script' },
]

export const SIGNATURE_FONT: TemplateFont = { family: 'Dancing Script', weight: 500, italic: false, category: 'script' }

const GENERIC: Record<FontCategory, string> = {
  sans: 'Arial, Helvetica, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: '"Courier New", monospace',
  script: 'cursive',
}

export function fontStack(font: TemplateFont): string {
  return `"${font.family.replace(/"/g, '')}", ${GENERIC[font.category] ?? GENERIC.sans}`
}

export function categoryFor(family: string): FontCategory {
  return FONT_PRESETS.find((p) => p.family.toLowerCase() === family.toLowerCase())?.category ?? 'sans'
}

// One stylesheet per family/weight/style, so a weight a family doesn't ship
// only fails that one request instead of the whole batch.
export function googleFontHref(font: Pick<TemplateFont, 'family' | 'weight' | 'italic'>): string {
  const fam = encodeURIComponent(font.family.trim()).replace(/%20/g, '+')
  return `https://fonts.googleapis.com/css2?family=${fam}:ital,wght@${font.italic ? 1 : 0},${font.weight}&display=swap`
}

// Best guess at a web font from a PDF's embedded font name
// ("ABCDEF+Poppins-SemiBoldItalic", "ArialMT", "TimesNewRomanPS-BoldMT").
export function fontFromPdfName(raw: string, flags?: { bold?: boolean; italic?: boolean; black?: boolean }): TemplateFont {
  const name = (raw || '').replace(/^[A-Z]{6}\+/, '')
  const [famPart, stylePart = ''] = name.split(/[-,]/)
  const style = stylePart.toLowerCase()
  let family = famPart.replace(/(PSMT|PS|MT)$/, '').replace(/([a-z])([A-Z])/g, '$1 $2').trim()
  const lower = family.toLowerCase()
  const aliases: Record<string, string> = {
    arial: 'Arimo', helvetica: 'Arimo', 'helvetica neue': 'Arimo', 'liberation sans': 'Arimo',
    'times new roman': 'Tinos', times: 'Tinos', 'liberation serif': 'Tinos',
    calibri: 'Carlito', cambria: 'Caladea', georgia: 'Gelasio',
    'courier new': 'Cousine', courier: 'Cousine',
  }
  family = aliases[lower] ?? family
  let weight = 400
  if (/thin|hairline/.test(style)) weight = 100
  else if (/extralight|ultralight/.test(style)) weight = 200
  else if (/light/.test(style)) weight = 300
  else if (/medium/.test(style)) weight = 500
  else if (/semibold|demibold/.test(style)) weight = 600
  else if (/extrabold|ultrabold/.test(style)) weight = 800
  else if (/black|heavy/.test(style)) weight = 900
  else if (/bold/.test(style)) weight = 700
  if (weight === 400 && flags?.black) weight = 900
  else if (weight === 400 && flags?.bold) weight = 700
  const italic = /italic|oblique/.test(style) || !!flags?.italic
  const category: FontCategory = FONT_PRESETS.find((p) => p.family === family)?.category
    ?? (/serif|times|garamond|baskerville|georgia|playfair|lora|merriweather/i.test(family) && !/sans/i.test(family) ? 'serif'
      : /mono|courier|code/i.test(family) ? 'mono' : 'sans')
  return { family: family || 'Arimo', weight, italic, category }
}

// ─── Values ───────────────────────────────────────────────────────────────────

export function fieldValue(f: TemplateField, values: Record<string, string> | undefined): string {
  const v = values?.[f.id]
  return v == null ? f.defaultValue : v
}

// A field is only drawn over the template once it differs from the template's
// own text — until then the original printed text shows through untouched.
export function isChanged(f: TemplateField, value: string): boolean {
  return value !== f.defaultValue
}

export function displayLines(f: TemplateField, value: string): string[] {
  const v = f.uppercase ? value.toUpperCase() : value
  return f.multiline ? v.split('\n') : [v.replace(/\n/g, ' ')]
}

// Where a line's anchor sits for the field's alignment (SVG text-anchor semantics).
export function anchorX(f: TemplateField): number {
  if (f.align === 'center') return f.tx + f.tw / 2
  if (f.align === 'right') return f.tx + f.tw
  return f.tx
}

export function sortFields(fields: TemplateField[]): TemplateField[] {
  return [...fields].sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x)
}

export function newFieldId(): string {
  return Math.random().toString(36).slice(2, 10)
}
