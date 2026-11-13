// Residential service agreements (CCR-0001...). Same particulars, scope and words as the finished mock-up.
// An agreement reads from the home while it's a draft; when it's sent, everything shown (particulars, scope and the
// clauses) is locked into `snap`, so a signed agreement never changes afterwards.
import { RES_CLAUSES } from './res-clauses'
import { cash2, dLong, dShort, eAddsOn, eLines, eTotal, eUnits, EOL_ADDK, qAddLines, qMoney, Q_TYPE, Q_WINF, type Quote, type WinFreq } from './home-quotes'

export const RES_PAY = 'Due on the day of each service; payments not made on the day incur a 10% late fee'
export const RES_TERM = 'No fixed term'

export type DocStatus = 'draft' | 'sent' | 'signed'
export interface Part { k: string; v: string }
export interface ScopeBox { heading: string; items: string[] }
export interface AgrSnap { parts: Part[]; scope: ScopeBox[]; clauses: { n: number; t: string; b: string }[] }

/** The fields of a home an agreement reads. */
export interface HomeLike {
  name: string; street?: string | null; suburb?: string | null; state?: string | null; postcode?: string | null
  kind: 'recurring' | 'oneoff'; every?: string | null; days?: string[] | null; anchor?: string | null; first_clean?: string | null
  start_time?: string | null; price: number; beds?: number | null; baths?: number | null; carpet_rooms?: number | null; hallways?: number | null
  windows_price?: number | null; windows_freq?: string | null; division?: 'res' | 'eol' | null
}

const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const DAY_NAME: Record<string, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' }
const joinAnd = (a: string[]) => (a.length <= 1 ? a[0] || '' : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1])
const plural = (n: number, one: string, many: string) => n + ' ' + (n === 1 ? one : many)

/** 07:30 → 7:30am, 13:00 → 1pm */
export function t12s(t?: string | null): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(t || '')
  if (!m) return ''
  const h = +m[1], mi = m[2]
  return (h % 12 || 12) + (mi === '00' ? '' : ':' + mi) + (h < 12 ? 'am' : 'pm')
}
export function addr(h: HomeLike): string {
  return [h.street, [h.suburb, h.state || 'QLD', h.postcode].filter(Boolean).join(' ')].filter(Boolean).join(', ')
}
export function freqLong(h: HomeLike): string {
  if (h.kind === 'oneoff') return 'One-off clean'
  const ds = DAY_ORDER.filter(d => (h.days || []).includes(d)).map(d => DAY_NAME[d])
  if (h.every === 'monthly') {
    const a = h.anchor || h.first_clean
    const wk = a ? Math.ceil(+a.slice(8, 10) / 7) : 1
    return 'Once a month, the ' + (wk >= 5 ? 'last' : ['first', 'second', 'third', 'fourth'][wk - 1]) + ' ' + (ds[0] || 'day') + ' of each month'
  }
  return (h.every === 'fortnightly' ? 'Every second ' : 'Every ') + joinAnd(ds)
}
export function homeText(h: HomeLike): string {
  const p = [plural(h.beds || 0, 'bedroom', 'bedrooms'), plural(h.baths || 0, 'bathroom', 'bathrooms')]
  if (h.carpet_rooms) p.push('carpet steam ' + plural(h.carpet_rooms, 'room', 'rooms'))
  if (h.hallways) p.push(plural(h.hallways, 'hallway', 'hallways'))
  return p.join(', ')
}

/** Schedule of particulars (the ref is shown from the agreement itself, above these). */
export function particulars(h: HomeLike, extras: Part[] = []): Part[] {
  const parts: Part[] = [
    { k: 'Client', v: h.name },
    { k: 'Premises', v: addr(h) || 'To be confirmed' },
    { k: 'Commencement date', v: h.first_clean ? dLong(h.first_clean) : 'To be confirmed' },
    { k: 'Services', v: (h.division === 'eol' ? 'End of lease clean: ' : 'Residential clean: ') + homeText(h) },
    { k: 'Frequency', v: freqLong(h) + (h.start_time ? ', from ' + t12s(h.start_time) : '') },
    { k: 'Fees', v: (h.price > 0 ? cash2(h.price) : '$0.00') + ' per clean, including GST' },
  ]
  const adds = extras.length ? extras : homeAddOns(h)
  parts.push(...adds)
  parts.push({ k: 'Payment terms', v: RES_PAY }, { k: 'Term', v: RES_TERM })
  return parts
}
function homeAddOns(h: HomeLike): Part[] {
  if (!(h.windows_price && h.windows_price > 0)) return []
  const f = (h.windows_freq || 'monthly') as WinFreq
  return [{ k: 'Add-ons', v: 'Internal windows ' + cash2(h.windows_price) + ' including GST' + (h.kind === 'oneoff' ? '' : ', ' + Q_WINF[f]) }]
}

/** The mock-up's standard scope, for an agreement made from a client's page (no quote behind it). */
export function standardScope(h: HomeLike): ScopeBox[] {
  const items = [
    'Kitchen: benches, splashback, cooktop, outside of appliances, sink, cupboard fronts, floors',
    'Bathrooms and toilets: shower, bath, basin, toilet, mirrors, tiles, floors',
    'Bedrooms and living areas: dusting of reachable surfaces, skirting boards, vacuum and mop floors',
    'Bins emptied, beds made if linen is left out',
  ]
  if (h.carpet_rooms) items.push('Carpet steam clean: ' + plural(h.carpet_rooms, 'room', 'rooms') + (h.hallways ? ' and ' + plural(h.hallways, 'hallway', 'hallways') : ''))
  return [{ heading: '', items }]
}

/** Snapshot for the agreement that follows an accepted quote: the quote's own scope and add-ons (clause 3). */
export function snapFromQuote(q: Quote, a: { street: string; suburb: string; postcode: string; start: string }): AgrSnap {
  const eol = q.type === 'eol'
  const rec = !eol && q.every !== 'oneoff'
  const deepCarpet = q.carpet.on && q.type === 'deep'
  const eCarpet = eol ? eAddsOn(q).find(x => x.k === 'carpet') : undefined
  const dow = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date(a.start + 'T00:00:00Z').getUTCDay()]
  const h: HomeLike = {
    name: q.name.trim(), street: a.street.trim(), suburb: a.suburb.trim(), postcode: a.postcode, state: 'QLD',
    kind: rec ? 'recurring' : 'oneoff', every: rec ? q.every : null, days: rec ? [dow] : [], anchor: rec && q.every !== 'weekly' ? a.start : null,
    first_clean: a.start, price: Math.round((eol ? eTotal(q) : qMoney(q.price)) * 100) / 100, beds: q.beds, baths: q.baths,
    carpet_rooms: deepCarpet ? +q.carpet.rooms || 0 : eCarpet ? +eCarpet.qty || 0 : 0, hallways: deepCarpet ? +q.carpet.halls || 0 : 0,
    division: eol ? 'eol' : 'res',
  }
  const adds: string[] = []
  if (q.windows.on) adds.push('Internal windows ' + cash2(qMoney(q.windows.price)) + (rec ? ', ' + Q_WINF[q.windows.freq || 'monthly'] : ''))
  if (deepCarpet) adds.push('Carpet steam cleaning ' + cash2(qMoney(q.carpet.price)))
  if (eol) for (const x of eAddsOn(q)) adds.push((EOL_ADDK[x.k]?.label || x.k) + (eUnits(x) ? ' × ' + eUnits(x) : '') + ' ' + cash2(qMoney(x.price)))
  const extras = adds.length ? [{ k: 'Add-ons', v: adds.join('; ') + ' (including GST)' }] : []
  const parts = particulars(h, extras)
  parts.splice(4, 0, { k: 'Quote', v: q.ref + ', ' + Q_TYPE[q.type] })
  const scope: ScopeBox[] = q.scope
    .map(g => ({ heading: g.heading.trim(), items: g.items.map(i => (i.text || '').trim()).filter(Boolean) }))
    .filter(g => g.items.length)
  if (q.windows.on) scope.push({ heading: 'Internal windows (add-on)', items: qAddLines(q, 'windows') })
  if (deepCarpet) scope.push({ heading: 'Carpet steam cleaning (add-on)', items: qAddLines(q, 'carpet') })
  if (eol) for (const x of eAddsOn(q)) scope.push({ heading: (EOL_ADDK[x.k]?.label || x.k) + ' (add-on)', items: eLines(x) })
  return { parts, scope, clauses: RES_CLAUSES }
}

/** Snapshot for an agreement made from a client's page. */
export function snapFromHome(h: HomeLike): AgrSnap {
  return { parts: particulars(h), scope: standardScope(h), clauses: RES_CLAUSES }
}

// ── rows ──────────────────────────────────────────────────────
export interface HomeDoc {
  id: string; division: 'res' | 'eol'; ref: string; code: string; homeId: string | null; homeName: string; homeEmail: string; status: DocStatus; created: string
  sentTo: string | null; sentAt: string | null; signedBy: string | null; signedAt: string | null; fromQuote: string | null; snap: AgrSnap | null
}
export const DOC_COLS = 'id, division, ref, code, home_id, status, snap, created_on, sent_to, sent_at, signed_by, signed_at, from_quote, homes(name, email)'
const d10 = (v: string | null) => (v ? String(v).slice(0, 10) : null)
export function docOf(r: any): HomeDoc {
  return {
    id: r.id, division: r.division === 'eol' ? 'eol' : 'res', ref: r.ref, code: r.code, homeId: r.home_id, homeName: r.homes?.name || 'Removed client', homeEmail: r.homes?.email || '', status: r.status, created: d10(r.created_on) || '',
    sentTo: r.sent_to, sentAt: d10(r.sent_at), signedBy: r.signed_by, signedAt: d10(r.signed_at), fromQuote: r.from_quote,
    snap: r.snap && Array.isArray(r.snap.parts) ? r.snap : null,
  }
}
export function docTag(d: { status: DocStatus }): [string, string] {
  if (d.status === 'signed') return ['Signed', 'tag wt']
  if (d.status === 'sent') return ['Waiting to sign', 'tag sent']
  return ['Draft', 'tag draft']
}
export function docMeta(d: HomeDoc): string {
  if (d.status === 'signed') return 'Signed by ' + d.signedBy + ' on ' + dShort(d.signedAt)
  if (d.status === 'sent') return 'Sent to ' + d.sentTo + ' on ' + dShort(d.sentAt)
  return 'Created ' + dShort(d.created) + ', not sent yet'
}
export function agreeRef(n: number, div: 'res' | 'eol' = 'res'): string { return (div === 'eol' ? 'CCE-' : 'CCR-') + String(n).padStart(4, '0') }
/** CCE- refs are End of Lease. */
export const refDiv = (ref: string): 'res' | 'eol' => (/^CCE-/.test(ref) ? 'eol' : 'res')
