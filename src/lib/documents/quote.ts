// Quote → service agreement.
//
// A quote is a proposal made from a company-document template and sent with
// "Send quote". The client opens /quote/<code> and presses Accept, which issues
// a service agreement prefilled from the quote's fields. They then only sign and
// pick a start date. Commercial clients go on to get a client profile and, once
// the owner saves their portal login, a welcome page. Residential and end-of-lease
// clients are prompted on the Clients tab instead and never get a welcome page.

import { fieldValue, type TemplateDocData } from './template'
import { DEFAULT_AGREEMENT, type AgreementData } from './agreement'

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
  for (const f of q.template.fields) {
    if (f.kind !== 'text') continue
    const explicit = f.agreementKey
    if (explicit === 'none') continue
    const key = (explicit && KEYS.has(explicit) ? explicit : guessAgreementKey(f.label)) as AgreementKey | null
    if (!key) continue
    const v = fieldValue(f, q.values).trim()
    if (!v) continue
    // An explicit mapping wins over a guess; otherwise the first field wins.
    if (out[key] == null || explicit) out[key] = v.replace(/\s*\n\s*/g, key === 'premises' ? ', ' : ' ')
  }
  if (!out.clientName && q.clientName?.trim()) out.clientName = q.clientName.trim()
  return out
}

/** A full agreement for an accepted template quote. The start date is left for the client. */
export function agreementFromQuote(q: TemplateDocData, agreementRef: string): AgreementData & Record<string, any> {
  return {
    ...DEFAULT_AGREEMENT,
    // Never carry the sample particulars (Northpoint, $5,400 / month…) onto a
    // real client's agreement: anything the quote doesn't fill stays blank.
    clientName: '', clientABN: '', premises: '', frequency: '', serviceFee: '',
    ...quoteToAgreementFields(q),
    proposalRef: q.refNumber ?? '',
    agreementRef,
    commencementDate: '',
    clientType: clientTypeOf(q),
    clientPicksStartDate: true,
  }
}
