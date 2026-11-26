// Website quote requests → draft proposals.
//
// The website's quote form posts each new request to /api/quote-requests. The
// hub picks the template set up for that kind of request, fills in every field
// it can recognise from the field's label and leaves the prices blank, so the
// owner only has to price it and press Send.

import { fieldValue, type DocTemplate, type TemplateField, type TemplateDocData } from './template'
import type { ClientType } from './quote'

export type QuoteRequestKind = 'residential_one_off' | 'residential_regular' | 'end_of_lease' | 'commercial'

export const QUOTE_REQUEST_KIND_LABELS: Record<QuoteRequestKind, string> = {
  residential_one_off: 'Residential one-off (deep clean)',
  residential_regular: 'Residential regular',
  end_of_lease: 'End of lease',
  commercial: 'Commercial',
}

export const CLIENT_TYPE_FOR_KIND: Record<QuoteRequestKind, ClientType> = {
  residential_one_off: 'residential',
  residential_regular: 'residential',
  end_of_lease: 'end_of_lease',
  commercial: 'commercial',
}

/** A request as the website sends it: contact details plus labelled rows. */
export interface QuoteRequest {
  name: string
  email: string
  phone: string
  service: string
  region?: string
  message?: string
  fields: { label: string; value: string }[]
  receivedAt: string
}

/** What a draft made from a request remembers, shown above the editor. */
export type QuoteRequestData = QuoteRequest & { kind: QuoteRequestKind }

/** The row whose label matches, e.g. row(r, /bedroom/) → "3". */
function row(r: QuoteRequest, re: RegExp): string {
  return r.fields.find((f) => re.test(f.label.toLowerCase()))?.value?.trim() ?? ''
}

/** Garage and balcony counts from an end of lease request, e.g. "Garage × 1, Balcony × 2". */
function otherRooms(r: QuoteRequest): string {
  return ['Garage', 'Balcony']
    .map((name) => [name, row(r, new RegExp(`^${name.toLowerCase()}$`))])
    .filter(([, n]) => n && n !== '0')
    .map(([name, n]) => `${name} × ${n}`)
    .join(', ')
}

export function kindOfRequest(r: QuoteRequest): QuoteRequestKind | null {
  const s = r.service.toLowerCase()
  if (/end of lease|bond/.test(s)) return 'end_of_lease'
  if (/commercial/.test(s)) return 'commercial'
  if (/residential/.test(s)) {
    return /one[\s-]?off|once/i.test(row(r, /frequen/)) ? 'residential_one_off' : 'residential_regular'
  }
  return null
}

// Only quote templates are ever used. Agreements, contracts and other company
// documents are never picked, even when tagged.
const NOT_A_QUOTE = /agreement|contract|terms|conditions|\bsop\b|procedure|policy|capability|subcontract|induction|swms|safety|invoice/

export function isQuoteTemplateName(name: string): boolean {
  return !NOT_A_QUOTE.test((name ?? '').toLowerCase())
}

/** Best guess at which kind of request a quote template is for, from its name. */
export function kindFromTemplateName(name: string): QuoteRequestKind | null {
  const n = (name ?? '').toLowerCase()
  if (!isQuoteTemplateName(n)) return null
  if (/end of lease|end-of-lease|bond|vacate|move[\s-]?out/.test(n)) return 'end_of_lease'
  if (/commercial|office/.test(n)) return 'commercial'
  // A one-off residential clean is a deep clean.
  if (/deep|one[\s-]?off|once[\s-]?off|spring/.test(n)) return 'residential_one_off'
  if (/residential|home|house|regular|recurring|weekly|fortnightly|monthly|ongoing|maintenance/.test(n)) return 'residential_regular'
  return null
}

/** The quote template for a request: one tagged for it, else one whose name says so. */
export function pickTemplate<T extends { name: string; template: DocTemplate | null }>(docs: T[], kind: QuoteRequestKind): T | null {
  const usable = docs.filter((d) => isQuoteTemplateName(d.name) && d.template && Array.isArray(d.template.fields) && d.template.fields.length > 0)
  const guessed = usable.filter((d) => !d.template!.autoDraftFor && kindFromTemplateName(d.name) === kind)
  return usable.find((d) => d.template!.autoDraftFor === kind)
    // Prefer a name that says it's a quote or proposal.
    ?? guessed.find((d) => /quote|proposal/i.test(d.name))
    ?? guessed[0]
    ?? null
}

const auDate = (d: Date) => d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Brisbane' })

/** "2026-10-15" → "15 October 2026"; anything else is left as written. */
function prettyDate(v: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  return m ? auDate(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 2))) : v
}

/** A field that holds a price, left blank on drafts made from a request. */
export function isPriceLabel(label: string): boolean {
  const l = (label ?? '').toLowerCase()
  return !/hours/.test(l) && /price|fee|cost|total|amount|investment|\brate|\$|gst|subtotal|per (clean|visit|hour)/.test(l)
}

// Prices for anything but the clean itself (windows, carpets, extras…), left for the owner.
const NOT_THE_CLEAN = /window|carpet|oven|blind|wall|fridge|mattress|sofa|couch|upholster|pressure|gutter|range ?hood|balcon|garage|extra|add-?on|optional|additional|deposit|discount|travel|call[\s-]?out/

/**
 * An extra on top of the clean itself (blinds, oven, carpets…) with its own price: a
 * price label, or any extra whose value is a dollar amount ("$80" or "80.00", never a bare
 * count like "2"). Deposits and discounts aren't extras.
 */
export function isExtraPrice(label: string, value = ''): boolean {
  const l = (label ?? '').toLowerCase()
  return NOT_THE_CLEAN.test(l) && !/deposit|discount/.test(l) && (isPriceLabel(l) || /^\s*\$|^\s*\d[\d,]*\.\d{2}\s*$/.test(value))
}

/**
 * A price field filled from the price the website worked out (residential requests
 * only), judged from the label: GST alone, ex GST, or else the GST-inclusive price.
 * Hourly rates and other services' prices are left blank, as is everything when the
 * website sent no price.
 */
function priceFromRequest(l: string, r: QuoteRequest): string {
  const exact = (label: string) => r.fields.find((f) => f.label.toLowerCase() === label)?.value?.trim() ?? ''
  const inc = exact('price (inc gst)')
  if (!inc || /\brate|per hour|hourly/.test(l) || NOT_THE_CLEAN.test(l)) return ''
  if (/gst/.test(l) && !/inc|ex\b|excl|total|plus|\+/.test(l)) return exact('gst')
  if (/\bex\b|ex[\s.-]*gst|excl|subtotal|plus gst|\+\s*gst/.test(l)) return exact('price (ex gst)')
  return inc
}

// End of lease add-ons the website prices, each sent as an "Add-on price: <name>" row.
// A template's price box for one of them is matched by its label.
const ADD_ONS: { field: RegExp; row: RegExp }[] = [
  { field: /carpet/, row: /carpet/ },
  { field: /blind/, row: /blind/ },
  { field: /wall/, row: /wall/ },
  { field: /furnish/, row: /furnish/ },
  { field: /fridge/, row: /fridge/ },
  { field: /mattress/, row: /mattress/ },
  { field: /sofa|couch/, row: /sofa/ },
]

/**
 * The price box for one add-on: a price label naming it ("Carpet steam price"), or a field
 * naming it whose template text is a dollar amount. Gets that add-on's price, e.g. "50.00",
 * or '' when it wasn't asked for. null = not an add-on price box.
 */
function addOnPrice(l: string, defaultValue: string, r: QuoteRequest): string | null {
  const addOn = ADD_ONS.find((a) => a.field.test(l))
  if (!addOn) return null
  const money = /^\s*\$|^\s*\d[\d,]*\.\d{2}\s*$/.test(defaultValue ?? '')
  if (!isPriceLabel(l) && !money) return null
  const price = r.fields.find((f) => {
    const m = /^add-on price:\s*(.*)$/.exec(f.label.toLowerCase())
    return m && addOn.row.test(m[1])
  })?.value?.trim()
  return price || (isPriceLabel(l) ? '' : null)
}

/**
 * What the request says for a template field, judged from the field's label.
 * '' = a price, left blank to fill in. null = nothing to say, keep the template's text.
 */
export function valueForField(f: TemplateField, r: QuoteRequest, ref: string, now: Date): string | null {
  const l = (f.label ?? '').toLowerCase().trim()
  if (!l) return null
  const address = row(r, /^(suburb \/ )?address$|^suburb/)
  const premises = address || r.region || row(r, /region/)

  if (/hours/.test(l)) return row(r, /hours/) || null
  if (/living/.test(l)) return row(r, /living/) || null
  const addOn = addOnPrice(l, f.defaultValue, r)
  if (addOn != null) return addOn
  if (isPriceLabel(l)) return priceFromRequest(l, r)
  if (/\bref|quote (no|number|#)|proposal (no|number|#)/.test(l)) return ref
  if (/e-?mail/.test(l)) return r.email
  if (/phone|mobile|contact number/.test(l)) return r.phone
  if (/business|company/.test(l)) return row(r, /business name/) || r.name
  if (/name|client|customer|prepared for|attention|attn/.test(l)) return r.name
  if (/address|premises|site|location|property address/.test(l)) return premises || null
  if (/suburb|region|area/.test(l)) return address || r.region || row(r, /region/) || null
  if (/bed/.test(l)) return row(r, /bedroom/) || null
  if (/bath/.test(l)) return row(r, /bathroom/) || null
  if (/kitchen/.test(l)) return row(r, /kitchen/) || null
  if (/property|premises type|home type/.test(l)) return row(r, /property type|premises type/) || null
  if (/size|sqm|square/.test(l)) return row(r, /size|sqm/) || null
  if (/frequen/.test(l)) return row(r, /frequen/) || null
  // Garage and balcony; the add-ons have their own boxes.
  if (/extra rooms?|other rooms?/.test(l)) return otherRooms(r) || null
  if (/extra|add-?on/.test(l)) return row(r, /extras/) || null
  if (/service|clean type|type of clean/.test(l)) return kindOfRequest(r) === 'residential_one_off' ? 'Deep Clean' : r.service
  if (/start|preferred|clean(ing)? date|move|booking|service date/.test(l)) {
    const d = row(r, /start date|cleaning date|move-out|preferred/)
    return d ? prettyDate(d) : null
  }
  if (/date|issued|valid from/.test(l)) return auDate(now)
  if (/note|message|comment|special|request/.test(l)) return r.message?.trim() || null
  return null
}

/** Field values for a draft made from a request. Fields it can't fill keep the template's text. */
export function valuesFromRequest(t: DocTemplate, r: QuoteRequest, ref: string, now = new Date()): Record<string, string> {
  const out: Record<string, string> = {}
  for (const f of t.fields) {
    if (f.kind !== 'text') continue
    const v = valueForField(f, r, ref, now)
    if (v != null) out[f.id] = f.multiline ? v : v.replace(/\s*\n\s*/g, ' ')
  }
  return out
}

/** Price fields still blank on a template document, by label. Sending is held until they're filled. */
export function blankPriceFields(d: TemplateDocData): string[] {
  return d.template.fields
    .filter((f) => f.kind === 'text' && isPriceLabel(f.label) && !fieldValue(f, d.values).trim())
    .map((f) => f.label)
}
