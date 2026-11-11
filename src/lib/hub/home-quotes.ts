// Residential quotes: website requests become draft quotes that Laith checks, edits and sends.
// Ported from the mock-up (Main.dc.html v80: quoteFromRequest, residentialScope, residentialTermsGlance,
// qCheck, qSave, qTotalLine, the quote document). Wording is the mock-up's, word for word.
// Pure functions only: used by the editor (browser), the server actions and the website request route.

import type { QuoteRequest } from '@/lib/documents/quote-request'
import { brisbaneToday } from './figures'

/** The Brisbane calendar day of a timestamp (the website sends UTC times). */
function brisbaneDay(ts?: string): string | undefined { if (!ts) return undefined; const d = new Date(ts); return isNaN(+d) ? ts.slice(0, 10) : brisbaneToday(d) }

export type QType = 'deep' | 'general'
export type QEvery = 'oneoff' | 'weekly' | 'fortnightly' | 'monthly'
export type QStatus = 'draft' | 'sent' | 'changes' | 'accepted' | 'declined'
export type WinFreq = 'each' | 'monthly' | 'quarterly' | 'once'
export interface Task { text: string }
export interface Box { heading: string; items: Task[] }

/** A website request, as the mock-up reads it (same rows as the "New Quote Request" email). */
export interface WebReq {
  receivedAt?: string; service?: string; message?: string; name?: string; phone?: string; email?: string; region?: string
  propertyType?: string; beds?: string; baths?: string; living?: string; frequency?: string; pets?: string; start?: string; hours?: string
  priceEx?: string; gst?: string; priceInc?: string; internalWindows?: string; windowsAddon?: string; carpetSteam?: string; carpetAddon?: string; totalWithAddons?: string
}

export interface QuoteBody {
  region: string; street: string; suburb: string; postcode: string
  heading: string; intro: string
  type: QType; every: QEvery; beds: number; baths: number; living: number
  start: string; hours: string; price: string; priceFromWeb: boolean; notes: string
  scope: Box[]
  windows: { on: boolean; price: string; detail: string; items: Task[]; fromWeb: boolean; webPrice: string; freq: WinFreq }
  carpet: { on: boolean; items: Task[]; price: string; rooms: string; halls: string; fromWeb: boolean; webPrice: string }
}

/** A whole quote as the screens use it. */
export interface Quote extends QuoteBody {
  id?: string; ref: string; code?: string; status: QStatus; source: 'website' | 'manual'; created: string
  req: WebReq; name: string; email: string; phone: string
  sentTo?: string | null; sentAt?: string | null; changedAt?: string | null; changeNote?: string | null
  declinedAt?: string | null; declineReason?: string | null; acceptedAt?: string | null; acceptedBy?: string | null; homeId?: string | null
}

// ── formatting (mock-up helpers) ──────────────────────────────
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function dLong(iso?: string | null): string { if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return ''; const p = iso!.split('-'); return `${+p[2]} ${MONTHS[+p[1] - 1]} ${p[0]}` }
export function dShort(iso?: string | null): string { if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return ''; const p = iso!.split('-'); return `${+p[2]} ${MON3[+p[1] - 1]} ${p[0]}` }
export function isoAdd(iso: string, n: number): string { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10) }
export function cash(n: number): string { return '$' + (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',') }
export function cash2(n: number): string { return (n < 0 ? '-$' : '$') + Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',') }
export function qMoney(v: unknown): number { const n = parseFloat(String(v || '').replace(/[^0-9.]/g, '')); return isNaN(n) ? 0 : n }
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// ── Laith's standard content ──────────────────────────────────
export const SPEC: Record<'Internal windows' | 'Carpet steam clean', string[]> = {
  'Carpet steam clean': ['Pre-vacuum of all carpeted areas', 'Pre-spray of traffic lanes and marks', 'Hot water extraction', 'Spot treatment of stains where possible', 'Carpet left to dry with airflow'],
  'Internal windows': ['Internal glass cleaned streak-free', 'Internal window frames wiped down', 'Window seals wiped and detailed', 'Window tracks vacuumed and wiped', 'Window sills wiped down'],
}
const tasks = (l: string[]): Task[] => l.map(text => ({ text }))

export function residentialScope(type: QType): Box[] {
  const deep = [
    { heading: 'Full kitchen', items: ['Oven, cooktop & range hood deep cleaned', 'Microwave, inside & out', 'Cupboards & drawers, inside & out', 'Benchtops & splashback degreased', 'Sink & tapware descaled'] },
    { heading: 'Bathrooms & ensuites', items: ['Wall & floor tiles scrubbed, grout detailed', 'Shower, screen & bathtub descaled', 'Toilet cleaned & sanitised', 'Vanity, cabinets, mirrors & fixtures', 'Exhaust fans & air vents dusted'] },
    { heading: 'Bedrooms & living areas', items: ['Wardrobes & built-ins, inside & out', 'Table tops wiped down', 'Mirrors, shelving & surfaces', 'Light fittings & ceiling fans dusted'] },
    { heading: 'Fixtures', items: ['Skirting boards wiped', 'Light switches & power points', 'Cobwebs removed throughout'] },
    { heading: 'Laundry', items: ['Trough/sink & tapware', 'Cabinets, inside & out', 'Exterior of washer/dryer'] },
    { heading: 'Floors', items: ['Floors vacuumed & mopped', 'Edges & corners detailed'] },
  ]
  const general = [
    { heading: 'Full kitchen', items: ['External oven & microwave, cooktop & range hood', 'Benchtops & splashback', 'Sink & tapware'] },
    { heading: 'Bathrooms & ensuites', items: ['Wall & floor tiles, shower & screen', 'Bathtub', 'Toilet', 'Vanity, mirrors & fixtures'] },
    { heading: 'Bedrooms & living areas', items: ['Wardrobes, inside & out', 'Table tops wiped down', 'Mirrors, shelving & surfaces', 'Reachable surfaces & fittings'] },
    { heading: 'Laundry', items: ['Trough/sink & tapware', 'Exterior of washer/dryer'] },
    { heading: 'Floors', items: ['Floors, vacuumed & mopped'] },
  ]
  return (type === 'deep' ? deep : general).map(g => ({ heading: g.heading, items: tasks(g.items) }))
}

export function residentialTermsGlance(type: QType, every?: QEvery): string[] {
  const one = every ? every === 'oneoff' : type === 'deep'
  const t = [
    'This quote is valid for 30 days from the date of issue and applies to the scope and price set out above.',
    'Scope is limited strictly to the areas and items listed above; anything not listed is excluded. Excessive soiling or items beyond scope may attract an additional charge, confirmed with you first.',
    one ? 'The Client must provide clear, safe access to the property for the duration of the clean.' : 'The Client must provide clear, safe access to the property for the duration of each visit.',
    'Payment is due on the same day as the service. Payments not made on the day of service will incur a 10% late fee.',
    one ? 'At least 24 hours’ notice is required to cancel or reschedule. Less notice, or a lockout on arrival, incurs a fee of up to 100% of the quoted price.' : 'At least 24 hours’ notice is required to cancel or reschedule a visit. Less notice, or a lockout on arrival, incurs a fee of up to 100% of that visit’s charge.',
  ]
  t.push(one ? 'This quote covers a one-off ' + (type === 'deep' ? 'deep clean' : 'clean') + '. Ongoing or additional services will be quoted separately.' : 'Once accepted, the service continues on a recurring basis until terminated by either party on 14 days’ written notice.')
  return t
}

export function residentialExcludes(): string {
  return 'Excludes carpet steam cleaning, pest control, rubbish removal, and any item outside the scope listed above. Table tops with excessive belongings are left untouched to avoid loss of items.'
}

// ── website request → quote ───────────────────────────────────
/** Where a website request goes. Residential Cleaning → Residential › Quotes (One-Off = Deep-Clean, else General Maintenance). */
export function requestRoute(w: { service?: string; frequency?: string }): { tab: 'eol' | 'commercial' | 'residential'; label: string; type?: QType } {
  const sv = String(w.service || 'Residential Cleaning').toLowerCase(), f = String(w.frequency || '').toLowerCase()
  if (/end of lease|bond|vacate/.test(sv)) return { tab: 'eol', label: 'End of Lease' }
  if (/commercial|office/.test(sv)) return { tab: 'commercial', label: 'Commercial' }
  return { tab: 'residential', label: 'Residential', type: /one|once|deep/.test(f) ? 'deep' : 'general' }
}

/** "15/11/2026" or "2026-11-15" → "2026-11-15"; anything else ''. */
function isoFrom(v: string): string {
  const s = (v || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s)
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''
}

/**
 * The website's labelled rows, read into the mock-up's request shape. Labels as the live form sends them
 * (checked 11 Nov 2026): "Internal Windows: Yes" + "Internal Windows Add-on: $60.00 inc GST (by bedrooms)",
 * the same pair for carpet, and "Total with Add-ons (inc GST)". Also reads "Add-on: Internal Windows" = "$80.00 inc GST".
 */
export function webReqFrom(r: QuoteRequest): WebReq {
  const rows = r.fields.map(f => ({ l: f.label.toLowerCase().trim(), v: f.value.trim() }))
  const get = (re: RegExp) => rows.find(x => re.test(x.l))?.v ?? ''
  const w: WebReq = {
    receivedAt: brisbaneDay(r.receivedAt), service: r.service, message: r.message ?? '', name: r.name, phone: r.phone, email: r.email,
    region: r.region || get(/^region/),
    propertyType: get(/property type|premises type/),
    beds: get(/^bedrooms?$|^no\.? of bedrooms|^number of bedrooms/), baths: get(/^bathrooms?$|^no\.? of bathrooms|^number of bathrooms/),
    living: get(/living/), frequency: get(/frequen/), pets: get(/^pets?\b|\bpets in\b/),
    start: isoFrom(get(/start date|preferred|cleaning date/)), hours: get(/hours/),
    priceEx: get(/^price \(ex gst\)$/), gst: get(/^gst$/), priceInc: get(/^price \(inc gst\)$/),
    internalWindows: get(/^internal windows\??$/), windowsAddon: get(/^internal windows add-?on/),
    carpetSteam: get(/^carpet steam clean(ing)?\??$/), carpetAddon: get(/^carpet steam clean(ing)? add-?on/),
    totalWithAddons: get(/total with add-?ons/),
  }
  const addWin = rows.find(x => /^add-?on:?\s*internal windows/.test(x.l))
  if (addWin) { w.internalWindows = 'Yes'; w.windowsAddon = addWin.v }
  const addCar = rows.find(x => /^add-?on:?\s*carpet/.test(x.l))
  if (addCar) { w.carpetSteam = 'Yes'; w.carpetAddon = addCar.v }
  return w
}

/** A website request, read into a quote. Prices from the website calculator are filled in for you to check. */
export function quoteFromRequest(w: WebReq, ref: string, today: string): Quote {
  const num = (v: unknown) => { const n = parseInt(String(v || '').replace(/[^0-9]/g, ''), 10); return isNaN(n) ? 0 : Math.min(n, 7) }
  const cashS = (v: unknown) => { const n = parseFloat(String(v || '').replace(/[^0-9.]/g, '')); return isNaN(n) ? '' : String(Math.round(n * 100) / 100) }
  const f = String(w.frequency || '').toLowerCase()
  const every: QEvery = /one|once|deep/.test(f) ? 'oneoff' : (/fortnight/.test(f) ? 'fortnightly' : (/month/.test(f) ? 'monthly' : 'weekly'))
  const type: QType = every === 'oneoff' ? 'deep' : 'general'
  const yes = (v: unknown) => /^\s*y/i.test(String(v || ''))
  const win = yes(w.internalWindows) ? /\$\s*([0-9.,]+)/.exec(w.windowsAddon || '') : null
  const car = type === 'deep' && yes(w.carpetSteam) ? /\$\s*([0-9.,]+)/.exec(w.carpetAddon || '') : null
  if (win) win[1] = win[1].replace(/,/g, ''); if (car) car[1] = car[1].replace(/,/g, '')
  const carRooms = car ? /(\d+)\s*room/i.exec(w.carpetAddon || '') : null, carHalls = car ? /(\d+)\s*hall/i.exec(w.carpetAddon || '') : null
  const notes: string[] = []
  if (w.pets) notes.push('Pets in the home: ' + w.pets)
  if (w.propertyType) notes.push(w.propertyType)
  if (w.message) notes.push('Their message: ' + String(w.message).trim())
  return {
    ref, status: 'draft', source: 'website', created: today, req: w,
    name: w.name || '', email: w.email || '', phone: w.phone || '', region: w.region || '', street: '', suburb: '', postcode: '',
    heading: type === 'deep' ? 'Your deep clean quote' : 'Your regular home clean quote',
    intro: 'Thanks for asking us to quote' + (w.propertyType ? ' for your ' + String(w.propertyType).toLowerCase().replace(' / apartment', '') : '') + '. Here is what we will do, what it costs and how it works.',
    type, every, beds: num(w.beds), baths: num(w.baths), living: num(w.living), start: /^\d{4}-\d{2}-\d{2}$/.test(w.start || '') ? w.start! : '', hours: String(w.hours || '').replace(/[^0-9.]/g, ''),
    price: cashS(w.priceInc), priceFromWeb: !!cashS(w.priceInc), notes: notes.join('. '),
    scope: residentialScope(type),
    windows: { on: !!win, price: win ? cashS(win[1]) : '', detail: 'Internal windows', items: tasks(SPEC['Internal windows']), fromWeb: !!win, webPrice: win ? cashS(win[1]) : '', freq: 'monthly' },
    carpet: { on: !!car, items: tasks(SPEC['Carpet steam clean']), price: car ? cashS(car[1]) : '', rooms: carRooms ? String(Math.min(+carRooms[1], 8)) : '0', halls: carHalls ? String(Math.min(+carHalls[1], 8)) : '0', fromWeb: !!car, webPrice: car ? cashS(car[1]) : '' },
  }
}

/** A blank quote for a phone enquiry ("New quote"). */
export function blankQuote(today: string): Quote {
  const b = quoteFromRequest({ frequency: 'Fortnightly' }, '', today)
  b.source = 'manual'; b.req = {}
  b.heading = 'Your regular home clean quote'
  b.intro = 'Thanks for asking us to quote. Here is what we will do, what it costs and how it works.'
  b.price = ''
  return b
}

// ── labels and rules ──────────────────────────────────────────
export const Q_EVERY: Record<QEvery, string> = { oneoff: 'One-off', weekly: 'Every week', fortnightly: 'Every fortnight', monthly: 'Once a month' }
export const Q_TYPE: Record<QType, string> = { deep: 'Deep-Clean', general: 'General Maintenance' }
export const Q_STATE: Record<QStatus, [string, string]> = { draft: ['To send', 'tag draft'], sent: ['Sent', 'tag sent'], changes: ['Wants changes', 'tag warn'], accepted: ['Accepted', 'tag wt'], declined: ['Declined', 'tag draft'] }
export const Q_WINF: Record<WinFreq, string> = { each: 'every clean', monthly: 'once a month', quarterly: 'every 3 months', once: 'once only, on the first clean' }
export const Q_WINF_OPTS: { v: WinFreq; label: string }[] = [{ v: 'each', label: 'Every clean' }, { v: 'monthly', label: 'Once a month' }, { v: 'quarterly', label: 'Every 3 months' }, { v: 'once', label: 'Once only (first clean)' }]
export const EVERY_OPTS: { v: QEvery; label: string }[] = [{ v: 'oneoff', label: 'One-off' }, { v: 'weekly', label: 'Every week' }, { v: 'fortnightly', label: 'Every fortnight' }, { v: 'monthly', label: 'Once a month' }]
export const DECLINE_REASONS = ['Price', 'Found another cleaner', 'No longer needed', 'Other'] as const

/** The price page's total line. One-off: everything together. Regular: depends on how often windows are charged. */
export function qTotalLine(every: QEvery, b: number, w: number, c: number, wf?: WinFreq): string {
  if (every === 'oneoff') return 'Total: ' + cash2(b + w + c) + ' incl GST'
  wf = wf || 'monthly'
  if (!w) return 'Total: ' + cash2(b) + ' incl GST per clean'
  if (wf === 'each') return 'Total: ' + cash2(b + w) + ' incl GST per clean, windows included'
  if (wf === 'once') return 'First clean total: ' + cash2(b + w) + ' incl GST, then ' + cash2(b) + ' per clean'
  return 'First clean total: ' + cash2(b + w) + ' incl GST. After that ' + cash2(b) + ' per clean, plus ' + cash2(w) + ' for windows ' + Q_WINF[wf]
}

const ADD_PRESET = { windows: 'Internal windows', carpet: 'Carpet steam clean' } as const
export function qAddItems(q: QuoteBody, k: 'windows' | 'carpet'): Task[] { return q[k].items ? q[k].items : tasks(SPEC[ADD_PRESET[k]]) }
export function qAddLines(q: QuoteBody, k: 'windows' | 'carpet'): string[] { return qAddItems(q, k).map(i => (i.text || '').trim()).filter(Boolean) }
export function standardAddItems(k: 'windows' | 'carpet'): Task[] { return tasks(SPEC[ADD_PRESET[k]]) }

export function qWhatLine(q: Quote): string { return Q_TYPE[q.type] + ' · ' + Q_EVERY[q.every] + ' · ' + q.beds + ' bed, ' + q.baths + ' bath' + (q.region ? ' · ' + q.region : '') }
export function qMeta(q: Quote): string {
  if (q.status === 'draft') return (q.source === 'website' ? 'From the website ' + dShort(q.created) + '. Check it and send' : 'Created ' + dShort(q.created) + ', not sent yet')
  if (q.status === 'sent') return 'Sent to ' + q.sentTo + ' on ' + dShort(q.sentAt)
  if (q.status === 'changes') return 'Asked for changes on ' + dShort(q.changedAt) + ': “' + q.changeNote + '”'
  if (q.status === 'accepted') return 'Accepted by ' + q.acceptedBy + ' on ' + dShort(q.acceptedAt) + '. Client set up under Residential'
  return 'Declined on ' + dShort(q.declinedAt) + (q.declineReason ? ': ' + q.declineReason : '')
}

/** Everything a quote needs before it can be sent. '' when it's ready. */
export function qCheck(q: Quote, today: string): string {
  if (!(q.name || '').trim()) return 'Add the client’s name.'
  if (!EMAIL_RE.test((q.email || '').trim())) return 'Add a valid email to send the quote to.'
  if (!q.scope.length || !q.scope.some(g => g.items.some(i => (i.text || '').trim()))) return 'The scope of works is empty. Add at least one task.'
  if (!(qMoney(q.price) > 0)) return 'Add the price per clean, including GST.'
  if (q.windows.on && !(qMoney(q.windows.price) > 0)) return 'Add the price for windows, or untick it.'
  if (q.windows.on && !qAddLines(q, 'windows').length) return 'List what’s included in the windows add-on, at least one task.'
  if (q.carpet.on && q.type === 'deep' && !qAddLines(q, 'carpet').length) return 'List what’s included in carpet steam cleaning, at least one task.'
  if (q.carpet.on && q.type === 'deep' && !(qMoney(q.carpet.price) > 0)) return 'Add the price for carpet steam cleaning, or untick it.'
  if (q.carpet.on && q.type === 'deep' && !(+q.carpet.rooms || +q.carpet.halls)) return 'Pick how many rooms or hallways for carpet steam cleaning.'
  if (q.start && q.start < today) return 'The preferred date has passed. Change it or clear it.'
  return ''
}

/** Tidy before saving: trim, drop blank tasks and empty boxes. */
export function qClean<T extends Quote>(y: T): T {
  y.name = (y.name || '').trim(); y.email = (y.email || '').trim()
  y.scope = y.scope.map(g => ({ heading: (g.heading || '').trim() || 'Area', items: g.items.filter(i => (i.text || '').trim()).map(i => ({ text: i.text.trim() })) })).filter(g => g.items.length)
  for (const k of ['windows', 'carpet'] as const) y[k].items = qAddLines(y, k).map(text => ({ text }))
  return y
}

/** The checks on Save draft / Preview (sending adds qCheck). '' when it can be saved. */
export function qSaveCheck(y: Quote, today: string): string {
  if (!y.name) return 'Add the client’s name.'
  if (y.email && !EMAIL_RE.test(y.email)) return 'Check the email address.'
  if (y.postcode && !/^\d{4}$/.test(y.postcode)) return 'Postcode is 4 digits.'
  if (y.start && y.start < today) return 'The preferred date has passed. Change it or clear it.'
  return ''
}

/** Note under the price in the editor: website price to check, and whether it still matches the website total. */
export function priceNote(q: Quote): string {
  if (!q.priceFromWeb) return ''
  const t = qMoney(q.req && q.req.totalWithAddons)
  let tail = ''
  if (t) {
    const mine = qMoney(q.price) + (q.windows.on ? qMoney(q.windows.price) : 0) + (q.type === 'deep' && q.carpet.on ? qMoney(q.carpet.price) : 0)
    tail = Math.abs(mine - t) < 0.01 ? ' Matches the website total of ' + cash2(t) + ' with add-ons.' : ' Heads up: the website total with add-ons was ' + cash2(t) + ', this quote now comes to ' + cash2(mine) + '.'
  }
  return 'Filled in from the website calculator. Check it before you send.' + tail
}

/** "Total…" line under the add-ons in the editor. */
export function addTotal(q: Quote): string {
  const b = qMoney(q.price), w = q.windows.on ? qMoney(q.windows.price) : 0, c = q.type === 'deep' && q.carpet.on ? qMoney(q.carpet.price) : 0
  if (!(w || c) || !(b > 0)) return ''
  return qTotalLine(q.every, b, w, c, q.windows.freq) + '.'
}

/** The website request rows shown above the editor. */
export function webRows(q: Quote): { k: string; v: string }[] {
  if (q.source !== 'website') return []
  const r = q.req
  const rows: [string, string | undefined][] = [
    ['Received', dShort(r.receivedAt || q.created)], ['Service', r.service || 'Residential Cleaning'], ['Property', r.propertyType], ['Bedrooms', r.beds], ['Bathrooms', r.baths],
    ['Living areas', r.living], ['How often', r.frequency], ['Pets', r.pets], ['Preferred start', r.start ? dShort(r.start) : ''], ['Region', r.region], ['Estimated hours', r.hours],
    ['Website price', r.priceInc ? r.priceInc + ' incl GST (' + r.priceEx + ' ex GST)' : ''], ['Message', r.message],
    ['Add-ons picked', [/^\s*y/i.test(r.internalWindows || '') ? 'Internal windows ' + r.windowsAddon : '', /^\s*y/i.test(r.carpetSteam || '') ? 'Carpet steam cleaning ' + r.carpetAddon : ''].filter(Boolean).join('; ') || 'None'],
    ['Total with add-ons', r.totalWithAddons ? r.totalWithAddons + ' incl GST' : ''],
  ]
  return rows.filter(x => x[1]).map(x => ({ k: x[0], v: x[1]! }))
}

// ── the quote document (admin preview and the client's page) ──
export interface QuoteDoc {
  ref: string; heading: string; intro: string; name: string; date: string; validTo: string; address: string; typeLabel: string; freqLine: string; homeLine: string
  scopeSub: string; excl: string; price: string; per: string; priceKick: string; hoursLine: string; totalLine: string; addonsLead: string
  scope: { num: string; heading: string; items: { text: string; tag: string }[] }[]
  terms: string[]
  addons: { name: string; desc: string; items: string[]; price: string }[]
}
export function quoteDoc(q: Quote, today: string): QuoteDoc {
  const price = qMoney(q.price)
  let excl = residentialExcludes()
  if (q.carpet.on && q.type === 'deep') excl = excl.replace('carpet steam cleaning, ', '')
  const addons: QuoteDoc['addons'] = []
  if (q.windows.on) addons.push({ name: 'Internal windows', desc: q.every === 'oneoff' ? '' : 'Charged ' + Q_WINF[q.windows.freq || 'monthly'] + '.', items: qAddLines(q, 'windows'), price: cash2(qMoney(q.windows.price)) })
  if (q.carpet.on && q.type === 'deep') {
    const cr = +q.carpet.rooms, ch = +q.carpet.halls
    addons.push({ name: 'Carpet Steam Cleaning', desc: [cr ? cr + (cr === 1 ? ' room' : ' rooms') : '', ch ? ch + (ch === 1 ? ' hallway' : ' hallways') : ''].filter(Boolean).join(' and '), items: qAddLines(q, 'carpet'), price: cash2(qMoney(q.carpet.price)) })
  }
  const from = q.sentAt || q.created || today
  return {
    ref: q.ref, heading: q.heading || 'Your cleaning quote', intro: q.intro || '', name: q.name, date: dLong(from), validTo: dLong(isoAdd(from, 30)),
    address: [q.street, [q.suburb, q.postcode].filter(Boolean).join(' ')].filter(Boolean).join(', ') || q.region || 'Address to be confirmed',
    typeLabel: Q_TYPE[q.type],
    freqLine: (q.every === 'oneoff' ? 'One-off ' + (q.type === 'deep' ? 'deep clean' : 'clean') : Q_EVERY[q.every]) + (q.start ? ', from ' + dLong(q.start) : ''),
    homeLine: q.beds + (q.beds === 1 ? ' bedroom' : ' bedrooms') + ', ' + q.baths + (q.baths === 1 ? ' bathroom' : ' bathrooms') + (q.living ? ', ' + q.living + (q.living === 1 ? ' living area' : ' living areas') : ''),
    scopeSub: q.type === 'deep' ? 'A detailed, top-to-bottom deep clean covering the following areas.' : 'A standard residential clean covering the following areas.',
    excl,
    price: price > 0 ? cash2(price) : '$0.00', per: q.every === 'oneoff' ? '' : 'per clean',
    priceKick: q.every === 'oneoff' ? 'One-off ' + Q_TYPE[q.type].toLowerCase() : Q_EVERY[q.every] + ', ' + Q_TYPE[q.type].toLowerCase(),
    hoursLine: q.hours ? 'About ' + q.hours + ' hours' + (q.every === 'oneoff' ? '' : ' each clean') : '',
    totalLine: addons.length ? qTotalLine(q.every, price, q.windows.on ? qMoney(q.windows.price) : 0, q.carpet.on && q.type === 'deep' ? qMoney(q.carpet.price) : 0, q.windows.freq) : '',
    addonsLead: addons.length > 1 ? 'The add-ons you asked for are included below.' : 'The add-on you asked for is included below.',
    scope: q.scope.map((g, i) => ({ num: ('0' + (i + 1)).slice(-2), heading: g.heading, items: g.items.map(it => { const m = /^(.*?)\s*\(([^()]*\*)\)\s*$/.exec(it.text || ''); return { text: m ? m[1] : it.text, tag: m ? m[2] : '' } }) })),
    terms: residentialTermsGlance(q.type, q.every),
    addons,
  }
}

// ── database row ⇄ quote ──────────────────────────────────────
const BODY_KEYS: (keyof QuoteBody)[] = ['region', 'street', 'suburb', 'postcode', 'heading', 'intro', 'type', 'every', 'beds', 'baths', 'living', 'start', 'hours', 'price', 'priceFromWeb', 'notes', 'scope', 'windows', 'carpet']
export function bodyOf(q: QuoteBody): QuoteBody { const o: any = {}; for (const k of BODY_KEYS) o[k] = (q as any)[k]; return o }

export interface QuoteRow {
  id: string; ref: string; code: string; source: 'website' | 'manual'; status: QStatus; name: string; email: string | null; phone: string | null
  body: QuoteBody; request: WebReq | null; created_on: string; sent_to: string | null; sent_at: string | null; changed_at: string | null; change_note: string | null
  declined_at: string | null; decline_reason: string | null; accepted_at: string | null; accepted_by: string | null; home_id: string | null
}
export const QUOTE_COLS = 'id, ref, code, source, status, name, email, phone, body, request, created_on, sent_to, sent_at, changed_at, change_note, declined_at, decline_reason, accepted_at, accepted_by, home_id'
const d10 = (v: string | null) => (v ? String(v).slice(0, 10) : null)
export function quoteOf(r: QuoteRow): Quote {
  const blank = blankQuote(d10(r.created_on) || '')
  const b = { ...bodyOf(blank), ...(r.body || {}) } as QuoteBody
  return {
    ...b, windows: { ...blank.windows, ...(b.windows || {}) }, carpet: { ...blank.carpet, ...(b.carpet || {}) },
    id: r.id, ref: r.ref, code: r.code, status: r.status, source: r.source, created: d10(r.created_on) || '', req: r.request || {},
    name: r.name || '', email: r.email || '', phone: r.phone || '',
    sentTo: r.sent_to, sentAt: d10(r.sent_at), changedAt: d10(r.changed_at), changeNote: r.change_note, declinedAt: d10(r.declined_at), declineReason: r.decline_reason,
    acceptedAt: d10(r.accepted_at), acceptedBy: r.accepted_by, homeId: r.home_id,
  }
}

/** Ref for a new quote: CCQ-0001 for residential. */
export function quoteRef(n: number): string { return 'CCQ-' + String(n).padStart(4, '0') }
