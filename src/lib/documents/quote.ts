// Quote → service agreement.
//
// A quote is a proposal made from a company-document template and sent with
// "Send quote". The client opens /quote/<code> and presses Accept, which issues
// a service agreement prefilled from the quote's fields. They then only sign and
// pick a start date. Commercial clients go on to get a client profile and, once
// the owner saves their portal login, a welcome page. Residential and end-of-lease
// clients are prompted on the Clients tab instead and never get a welcome page.

import { fieldValue, isChanged, type TemplateDocData } from './template'
import { isExtraPrice } from './quote-request'
import { DEFAULT_AGREEMENT, END_OF_LEASE_PAYMENT_TERMS, END_OF_LEASE_TERM, type AgreementData } from './agreement'

export type ClientType = 'commercial' | 'residential' | 'end_of_lease'

export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  commercial: 'Commercial',
  residential: 'Residential',
  end_of_lease: 'End of lease',
}

export function clientTypeOf(data: any): ClientType {
  const t = data?.clientType
  return t === 'residential' || t === 'end_of_lease' ? t : 'commercial'
}

// The agreement particulars a quote field can fill.
export type AgreementKey =
  | 'clientName' | 'premises' | 'frequency' | 'serviceFee'
  | 'initialTerm' | 'paymentTerms' | 'specialConditions' | 'clientABN'

export const AGREEMENT_KEY_OPTIONS: { value: AgreementKey | 'none' | ''; label: string }[] = [
  { value: '', label: 'Guess from the label' },
  { value: 'none', label: "Doesn't go on the agreement" },
  { value: 'clientName', label: 'Client / business name' },
  { value: 'premises', label: 'Site address' },
  { value: 'frequency', label: 'Frequency' },
  { value: 'serviceFee', label: 'Service fee / price' },
  { value: 'initialTerm', label: 'Initial term' },
  { value: 'paymentTerms', label: 'Payment terms' },
  { value: 'specialConditions', label: 'Special conditions' },
  { value: 'clientABN', label: 'Client ABN' },
]

const KEYS = new Set<string>(AGREEMENT_KEY_OPTIONS.map((o) => o.value).filter((v) => v && v !== 'none'))

// Best guess at what a field holds from its label, e.g. "Monthly price" → serviceFee.
export function guessAgreementKey(label: string): AgreementKey | null {
  const l = (label ?? '').toLowerCase()
  if (!l.trim()) return null
  if (/\babn\b/.test(l)) return 'clientABN'
  if (/contact|email|phone|mobile|attention|attn/.test(l)) return null
  if (/payment/.test(l)) return 'paymentTerms'
  if (/special|condition/.test(l)) return 'specialConditions'
  if (/(client|company|business|customer|organisation|organization)\s*(name)?$|business name|client name|company name/.test(l)) return 'clientName'
  if (/address|premises|site|location/.test(l)) return 'premises'
  if (/frequen|per week|per fortnight|nights|visits/.test(l)) return 'frequency'
  if (/price|fee|investment|total|cost|amount|\$|monthly|per month|quote value/.test(l)) return 'serviceFee'
  if (/\bterm\b|contract length|duration/.test(l)) return 'initialTerm'
  return null
}

/** The agreement particulars a template quote fills, field by field. */
export function quoteToAgreementFields(q: TemplateDocData): Partial<AgreementData> {
  const out: Partial<Record<AgreementKey, string>> = {}
  const eol = clientTypeOf(q) === 'end_of_lease'
  for (const f of q.template.fields) {
    if (f.kind !== 'text') continue
    const explicit = f.agreementKey
    if (explicit === 'none') continue
    const key = (explicit && KEYS.has(explicit) ? explicit : guessAgreementKey(f.label)) as AgreementKey | null
    if (!key) continue
    // End of lease extras (blinds, oven…) are added to the fee below, never taken as it,
    // and neither is a GST-only, ex-GST or subtotal box: the fee is the GST-inclusive price.
    if (key === 'serviceFee' && !explicit && eol && (isExtraPrice(f.label, fieldValue(f, q.values)) || notTheFullPrice(f.label))) continue
    const raw = fieldValue(f, q.values)
    const v = raw.trim()
    if (!v) continue
    // The template's own placeholder ("Client Name") is never a real client name.
    if (key === 'clientName' && !isChanged(f, raw)) continue
    // An explicit mapping wins over a guess; otherwise the first field wins.
    if (out[key] == null || explicit) out[key] = v.replace(/\s*\n\s*/g, key === 'premises' ? ', ' : ' ')
  }
  if (eol) {
    const fee = endOfLeaseFee(q, out.serviceFee)
    if (fee) out.serviceFee = fee
  }
  if (!out.clientName) {
    // The editor's "Client" box starts as the template's name; only use it once it's been changed.
    const listed = q.clientName?.trim()
    if (listed && listed !== q.templateName?.trim()) out.clientName = listed
  }
  return out
}

/** A GST-only, ex-GST or subtotal price box, e.g. "GST $" or "Subtotal (ex GST)". */
function notTheFullPrice(label: string): boolean {
  const l = (label ?? '').toLowerCase()
  return /subtotal|\bex\b|ex[\s.-]*gst|excl|plus gst|\+\s*gst/.test(l) || (/\bgst\b/.test(l) && !/inc|total/.test(l))
}

/** "$1,234.50" → 1234.5; null when there's no amount. */
function money(v: string): number | null {
  // Prefer the dollar amount, so "3 blinds $20" reads as 20.
  const m = /\$\s*(\d[\d,]*(?:\.\d+)?)/.exec(v ?? '') ?? /(\d[\d,]*(?:\.\d+)?)/.exec(v ?? '')
  if (!m) return null
  const n = Number(m[1].replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

const aud = (n: number) => `$${n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * End of lease: the agreement's fee is the quoted price plus every extra with a price
 * (blinds, oven…). Extras of $0.00 are left off. Prices already include GST.
 */
function endOfLeaseFee(q: TemplateDocData, quoted: string | undefined): string | null {
  const base = quoted ? money(quoted) : null
  if (base == null) return null
  const extras: { label: string; amount: number }[] = []
  for (const f of q.template.fields) {
    const value = f.kind === 'text' ? fieldValue(f, q.values) : ''
    if (f.kind !== 'text' || !isExtraPrice(f.label, value)) continue
    const amount = money(value)
    if (amount) extras.push({ label: f.label.replace(/\b(price|cost|fee|amount)\b|\$|\(.*?\)|:/gi, '').replace(/\s+/g, ' ').trim() || f.label, amount })
  }
  if (!extras.length) return null
  const total = extras.reduce((sum, e) => sum + e.amount, base)
  return `${aud(total)} incl. GST (clean ${aud(base)} + ${extras.map((e) => `${e.label} ${aud(e.amount)}`).join(' + ')})`
}

/** The client's name as written on the quote, or '' if it hasn't been filled in. */
export function quoteClientName(q: TemplateDocData): string {
  return quoteToAgreementFields(q).clientName ?? ''
}

/** A full agreement for an accepted template quote. The start date is left for the client. */
export function agreementFromQuote(q: TemplateDocData, agreementRef: string): AgreementData & Record<string, any> {
  const type = clientTypeOf(q)
  const fromQuote = quoteToAgreementFields(q)
  return {
    ...DEFAULT_AGREEMENT,
    // Never carry the sample particulars (Northpoint, $5,400 / month…) onto a
    // real client's agreement: anything the quote doesn't fill stays blank.
    clientName: '', clientABN: '', premises: '', frequency: '', serviceFee: '',
    ...fromQuote,
    // End of lease is a one-off clean, paid for before it's finished.
    ...(type === 'end_of_lease' ? {
      frequency: fromQuote.frequency || END_OF_LEASE_TERM,
      initialTerm: END_OF_LEASE_TERM,
      paymentTerms: END_OF_LEASE_PAYMENT_TERMS,
    } : {}),
    proposalRef: q.refNumber ?? '',
    agreementRef,
    commencementDate: '',
    clientType: type,
    clientPicksStartDate: true,
  }
}
