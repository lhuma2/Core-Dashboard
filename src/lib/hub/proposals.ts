// Commercial proposals and agreements: the form, every check, the document text and the agreement particulars,
// ported from the finished mock-up (Main.dc.html: blankPf, checkProp, cleanProp, propDoc, partsFromProp, agParticulars,
// the signing checks). Pure functions: the screens use them for instant messages and the server repeats them.

import { COMM_CLAUSES, SPEC_CLAUSES, SPEC_METHODS, type Clause, type PresetScope } from './comm-text'
import { normPhone } from './new-client'

export { COMM_CLAUSES, SPEC_CLAUSES, SPEC_METHODS }
export type { Clause, PresetScope }

// ── dates and money ─────────────────────────────────────────
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const isIso = (v?: string | null) => /^\d{4}-\d{2}-\d{2}$/.test(v || '')
export function dLong(iso?: string | null): string { if (!isIso(iso)) return ''; const p = iso!.split('-'); return `${+p[2]} ${MONTHS[+p[1] - 1]} ${p[0]}` }
export function dShort(iso?: string | null): string { if (!isIso(iso)) return ''; const p = iso!.split('-'); return `${+p[2]} ${MON3[+p[1] - 1]} ${p[0]}` }
export function isoAdd(iso: string, n: number): string { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10) }
export function daysBetween(a: string, b: string): number { const x = a.split('-').map(Number), y = b.split('-').map(Number); return Math.round((Date.UTC(y[0], y[1] - 1, y[2]) - Date.UTC(x[0], x[1] - 1, x[2])) / 86400000) }
/** The last day of the initial term: start + months, less a day. */
export function termEnd(start: string, months: number): string { const p = start.split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1 + months, p[2] - 1)).toISOString().slice(0, 10) }
export function money(v: unknown): number | null {
  const t = String(v == null ? '' : v).replace(/[$,\s]/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null
  const n = parseFloat(t)
  return n > 0 ? n : null
}
export function fmt2(n: number): string { const r = (Math.round(n * 100) / 100).toFixed(2).split('.'); return '$' + r[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + r[1] }
export function fmt$(n: number): string {
  const r = Math.round(n * 100) / 100, whole = Math.floor(r), cents = Math.round((r - whole) * 100)
  return '$' + whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (cents ? '.' + (cents < 10 ? '0' : '') + cents : '')
}
export function t12s(t?: string | null): string {
  if (!/^\d{2}:\d{2}/.test(t || '')) return ''
  let h = parseInt(t!.slice(0, 2), 10); const m = t!.slice(3, 5); const ap = h >= 12 ? 'pm' : 'am'
  h = h % 12 || 12
  return h + (m === '00' ? '' : ':' + m) + ap
}
export const tidy = (x?: string | null) => (x || '').trim().replace(/\s+/g, ' ')
export const EMAIL_OK = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

// ── the choices on the form ─────────────────────────────────
export const P_FREQ = {
  d5: { perWeek: 5, line: 'Five visits per week, Monday to Friday', short: 'Daily, Mon to Fri', kick: 'Daily clean', word: 'daily (Mon to Fri)', label: 'Daily (Monday to Friday)' },
  w3: { perWeek: 3, line: 'Three visits per week', short: '3× / week', kick: 'Per clean, 3 times a week', word: '3 times a week', label: '3 times a week' },
  w2: { perWeek: 2, line: 'Two visits per week', short: '2× / week', kick: 'Per clean, 2 times a week', word: '2 times a week', label: '2 times a week' },
  w1: { perWeek: 1, line: 'One visit per week', short: 'Weekly', kick: 'Weekly clean', word: 'weekly', label: 'Weekly' },
  f1: { perWeek: 0.5, line: 'One visit per fortnight', short: 'Fortnightly', kick: 'Fortnightly clean', word: 'fortnightly', label: 'Fortnightly' },
} as const
export type FreqKey = keyof typeof P_FREQ
export const P_WHEN = { after: 'after hours', early: 'early morning, before opening', day: 'during business hours', weekend: 'on weekends' } as const
export const WHEN_OPTS: [WhenKey, string][] = [['after', 'After hours'], ['early', 'Early morning, before opening'], ['day', 'During business hours'], ['weekend', 'On weekends']]
export type WhenKey = keyof typeof P_WHEN
export const P_WIN = { day: 'During the day', after: 'After hours', weekend: 'On a weekend' } as const
export type WinKey = keyof typeof P_WIN
export const P_WIN_TIME: Record<WinKey, string> = { day: '08:00', after: '18:00', weekend: '08:00' }
export const ADD_SHORT: Record<string, string> = { once: 'One-off', weekly: 'Weekly', fortnightly: 'Fortnightly', monthly: '1× / month', quarterly: '1× / quarter', six_monthly: 'Every 6 months', yearly: '1× / year' }
export const ADD_ADJ: Record<string, string> = { once: 'One-off', weekly: 'Weekly', fortnightly: 'Fortnightly', monthly: 'Monthly', quarterly: 'Quarterly', six_monthly: 'Six-monthly', yearly: 'Yearly' }
export const ADD_FREQ_OPTS: [string, string][] = [['once', 'One-off'], ['weekly', 'Weekly'], ['fortnightly', 'Fortnightly'], ['monthly', 'Monthly'], ['quarterly', 'Quarterly'], ['six_monthly', 'Every 6 months'], ['yearly', 'Yearly']]
export const EXTRA_PER_YEAR: Record<string, number> = { once: 0, weekly: 52, fortnightly: 26, monthly: 12, quarterly: 4, six_monthly: 2, yearly: 1 }
export const ADDON_KINDS = ['Internal windows', 'Internal & external windows', 'Pressure washing', 'Vinyl strip and seal', 'Carpet steam clean', 'Custom'] as const
export const JOB_KINDS = ['Carpet steam clean', 'Vinyl strip and seal', 'Internal windows', 'Internal & external windows', 'Pressure washing', 'Custom'] as const
export const DECLINE_WHY = ['Price is higher than expected', 'Going with another provider', 'Not the right time yet', 'The scope doesn’t suit what we need', 'Other'] as const
const EXCL_COMM = 'rubbish removal from site, carpet steam cleaning, pest control, and any item outside the scope listed above.'
const EXCL_SPEC = 'moving heavy furniture or equipment, permanent stains or damage, and any area not listed above.'

// ── the proposal ────────────────────────────────────────────
export interface Task { text: string; orig?: string; src?: string[] }
export interface SowHead { heading: string; src?: string[]; items: Task[] }
export interface Addon { kind: string; custom: string; freq: string; desc: string; price: string; items?: { text: string }[] }
export interface Job { kind: string; custom: string; area: string; included: string; price: string }
export type PStatus = 'draft' | 'sent' | 'revision' | 'accepted' | 'declined'
export type PType = 'comm' | 'spec'

/** What the form edits. Everything except the client and status lives in proposals.body. */
export interface Pf {
  id: string | null; ptype: PType; ref: string; created: string; status: PStatus
  biz: string; contact: string; email: string; address: string
  leadId: string | null; clientId: string | null; requestId: string | null
  freq: FreqKey; when: WhenKey; price: string; presets: Record<string, boolean>; sow: SowHead[]; addons: Addon[]
  jobs: Job[]; date2: string; window: WinKey; excl: string; uploadName: string
}
export const blankJob = (): Job => ({ kind: '', custom: '', area: '', included: '', price: '' })
export const blankAddon = (): Addon => ({ kind: '', custom: '', freq: '', desc: '', price: '', items: [] })
export function blankPf(ptype: PType, ref: string, today: string): Pf {
  return {
    id: null, ptype, ref, created: today, status: 'draft', biz: '', contact: '', email: '', address: '', leadId: null, clientId: null, requestId: null,
    freq: 'w1', when: 'after', price: '', presets: {}, sow: [], addons: [], jobs: [blankJob()], date2: '', window: 'day',
    excl: ptype === 'spec' ? EXCL_SPEC : EXCL_COMM, uploadName: '',
  }
}

/** A saved proposal, as the list and the document read it. */
export interface Prop extends Pf {
  id: string; code: string; sentTo: string; sentAt: string | null; revisionAt: string | null; revisionNote: string
  declinedAt: string | null; reason: string; note: string; acceptedAt: string | null; acceptedBy: string
  worksDate: string | null; setupClientId: string | null
  agr: null | { id: string; ref: string; code: string; status: 'draft' | 'sent' | 'signed'; signedBy: string; clientId: string | null }
  booked: boolean
}

export const PROP_COLS = 'id, ptype, ref, code, status, biz, contact, email, address, body, lead_id, client_id, request_id, created_on, sent_to, sent_at, revision_at, revision_note, declined_at, decline_reason, decline_note, accepted_at, accepted_by, works_date, setup_client_id'
const d10 = (v: unknown) => (typeof v === 'string' && isIso(v.slice(0, 10)) ? v.slice(0, 10) : null)
const str = (v: unknown, max = 3000) => (typeof v === 'string' ? v : v == null ? '' : String(v)).slice(0, max)

export function bodyOf(p: Pf): Record<string, unknown> {
  return p.ptype === 'comm'
    ? { freq: p.freq, when: p.when, price: p.price, presets: p.presets, sow: p.sow, addons: p.addons, excl: p.excl, uploadName: p.uploadName }
    : { jobs: p.jobs, date2: p.date2, window: p.window, excl: p.excl }
}

export function propOf(r: any, agr?: Prop['agr'], booked = false): Prop {
  const b = r.body && typeof r.body === 'object' ? r.body : {}
  const ptype: PType = r.ptype === 'spec' ? 'spec' : 'comm'
  const freq = (b.freq in P_FREQ ? b.freq : 'w1') as FreqKey
  return {
    id: r.id, ptype, ref: r.ref, code: r.code, status: r.status, created: d10(r.created_on) || '',
    biz: str(r.biz, 200), contact: str(r.contact, 200), email: str(r.email, 320), address: str(r.address, 300),
    leadId: r.lead_id || null, clientId: r.client_id || null, requestId: r.request_id || null,
    freq, when: (b.when in P_WHEN ? b.when : 'after') as WhenKey, price: str(b.price, 20),
    presets: b.presets && typeof b.presets === 'object' ? b.presets : {},
    sow: Array.isArray(b.sow) ? b.sow : [], addons: Array.isArray(b.addons) ? b.addons : [],
    jobs: Array.isArray(b.jobs) && b.jobs.length ? b.jobs : [blankJob()], date2: str(b.date2, 10), window: (b.window in P_WIN ? b.window : 'day') as WinKey,
    excl: typeof b.excl === 'string' ? b.excl : (ptype === 'spec' ? EXCL_SPEC : EXCL_COMM), uploadName: str(b.uploadName, 200),
    sentTo: str(r.sent_to, 320), sentAt: d10(r.sent_at), revisionAt: d10(r.revision_at), revisionNote: str(r.revision_note, 2000),
    declinedAt: d10(r.declined_at), reason: str(r.decline_reason, 200), note: str(r.decline_note, 2000),
    acceptedAt: d10(r.accepted_at), acceptedBy: str(r.accepted_by, 200), worksDate: d10(r.works_date), setupClientId: r.setup_client_id || null,
    agr: agr || null, booked,
  }
}

// ── scope presets: ticking more than one merges them, shared tasks once ──
export function addPresetSow(sow: SowHead[], preset: PresetScope): SowHead[] {
  const out: SowHead[] = (sow || []).map(h => ({ heading: h.heading, src: (h.src || []).slice(), items: h.items.map(it => ({ text: it.text, orig: it.orig, src: (it.src || []).slice() })) }))
  for (const ph of preset.sow) {
    let h = out.find(x => x.heading.trim().toLowerCase() === ph.heading.toLowerCase())
    if (!h) { h = { heading: ph.heading, src: [], items: [] }; out.push(h) }
    if (!h.src!.includes(preset.id)) h.src!.push(preset.id)
    for (const t of ph.items) {
      let it = h.items.find(x => x.text.trim().toLowerCase() === t.toLowerCase())
      if (!it) { it = { text: t, orig: t, src: [] }; h.items.push(it) }
      if (!it.src!.includes(preset.id)) it.src!.push(preset.id)
    }
  }
  return out
}
/** Unticking removes only that preset's tasks you haven't changed (and its headings left empty). */
export function removePresetSow(sow: SowHead[], id: string): SowHead[] {
  const out: SowHead[] = []
  for (const h of sow || []) {
    const hs = (h.src || []).filter(s => s !== id)
    const items: Task[] = []
    for (const it of h.items) {
      const had = (it.src || []).includes(id)
      const rest = (it.src || []).filter(s => s !== id)
      if (had && !rest.length && it.text === it.orig) continue
      items.push({ text: it.text, orig: it.orig, src: rest })
    }
    if (!items.length && (h.src || []).includes(id)) continue
    out.push({ heading: h.heading, src: hs, items })
  }
  return out
}

// ── add-ons and specialist services ─────────────────────────
export const addName = (a: Addon) => (a.kind === 'Custom' ? tidy(a.custom) : a.kind)
export const addItems = (a: Addon): { text: string }[] => (a.items ? a.items : (SPEC_METHODS[a.kind] || []).map(t => ({ text: t })))
export const addLines = (a: Addon) => addItems(a).map(it => tidy(it.text)).filter(Boolean)
export const addBox = (a: Addon) => ({ heading: addName(a) + ' (add-on, ' + (ADD_ADJ[a.freq] || '').toLowerCase() + ')', items: addLines(a).map(t => ({ text: t })) })
export const jobName = (j: Job) => (j.kind === 'Custom' ? tidy(j.custom) : j.kind)
export const jobLines = (j: Job) => String(j.included || '').split('\n').map(tidy).filter(Boolean)
export const propTotal = (p: Pick<Pf, 'jobs'>) => (p.jobs || []).reduce((s, jb) => s + (money(jb.price) || 0), 0)

/** Monthly value (incl GST) of a commercial proposal with its recurring add-ons. Only shown to Laith. */
export function pfMonthly(p: Pf): number {
  const price = money(p.price)
  if (p.ptype !== 'comm' || !price || !P_FREQ[p.freq]) return 0
  let m = price * P_FREQ[p.freq].perWeek * 52 / 12
  for (const a of p.addons || []) { const pa = money(a.price), py = EXTRA_PER_YEAR[a.freq] || 0; if (pa && py) m += pa * py / 12 }
  return m
}

// ── checks ──────────────────────────────────────────────────
/** Save draft needs only the business name. */
export function draftCheck(p: Pf): string {
  if (tidy(p.biz).length < 2) return 'Enter the business name before saving.'
  return ''
}
/** Full check before preview or send. '' when the proposal is complete. Same words as the mock-up. */
export function checkProp(p: Pf, today: string): string {
  if (tidy(p.biz).length < 2) return 'Enter the business name.'
  if (tidy(p.contact).length < 2) return 'Enter the contact name. It goes on the cover and the letter.'
  if (tidy(p.address).length < 5) return 'Enter the site address.'
  const em = (p.email || '').trim()
  if (em && !EMAIL_OK(em)) return 'That email address doesn’t look right.'
  if (p.ptype === 'comm') {
    if (!P_FREQ[p.freq]) return 'Choose how often the clean happens.'
    if (!money(p.price)) return 'Enter the price per clean as a dollar amount, e.g. 185.'
    if (!(p.sow || []).length) return 'The scope of works is empty. Tick a site type, upload a scope, or add a heading.'
    for (const h of p.sow) {
      const hd = tidy(h.heading)
      if (!hd) return 'One of the scope headings is empty. Name it or remove it.'
      if (!h.items.length) return 'The ' + hd + ' heading has no tasks. Add one or remove the heading.'
      if (h.items.some(it => !tidy(it.text))) return 'There’s an empty task under ' + hd + '. Fill it in or remove it.'
    }
    for (let a = 0; a < (p.addons || []).length; a++) {
      const ad = p.addons[a]
      if (!ad.kind) return 'Choose which service add-on ' + (a + 1) + ' is, or remove it.'
      if (!addName(ad)) return 'Give the custom add-on a name.'
      if (!ADD_ADJ[ad.freq]) return 'Choose how often ' + addName(ad) + ' happens.'
      if (!money(ad.price)) return 'Enter the price for ' + addName(ad) + ', e.g. 120.'
      if (addItems(ad).some(it => !tidy(it.text))) return 'There’s an empty task under ' + addName(ad) + '. Fill it in or remove it.'
      if (!addLines(ad).length) return 'List what’s included in ' + addName(ad) + ', at least one task.'
    }
  } else {
    if (!(p.jobs || []).length) return 'Add at least one service.'
    for (let j = 0; j < p.jobs.length; j++) {
      const jb = p.jobs[j], lab = 'Service ' + (j + 1)
      if (!jb.kind) return lab + ': choose the service.'
      if (!jobName(jb)) return lab + ': give the custom service a name.'
      if (!tidy(jb.area)) return jobName(jb) + ': say where and how much, e.g. Ground floor offices, about 140 m².'
      if (!jobLines(jb).length) return jobName(jb) + ': list what’s included, one per line.'
      if (!money(jb.price)) return jobName(jb) + ': enter the price as a dollar amount, e.g. 650.'
    }
    if (p.date2 && !isIso(p.date2)) return 'The proposed date isn’t valid.'
    if (p.date2 && p.date2 < today) return 'The proposed date is in the past.'
  }
  return ''
}
/** Tidies the text before saving, keeps only what belongs to that kind of proposal. */
export function cleanProp(p: Pf): Pf {
  const q: Pf = JSON.parse(JSON.stringify(p))
  q.biz = tidy(q.biz); q.contact = tidy(q.contact); q.address = tidy(q.address); q.email = (q.email || '').trim(); q.excl = tidy(q.excl)
  if (q.ptype === 'comm') {
    q.addons = (q.addons || []).map(a => ({ kind: a.kind, custom: tidy(a.custom), freq: a.freq, desc: tidy(a.desc), price: (a.price || '').trim(), items: addLines(a).map(t => ({ text: t })) }))
    q.sow = (q.sow || []).map(h => ({ heading: tidy(h.heading), src: h.src || [], items: h.items.map(it => ({ text: tidy(it.text), orig: it.orig, src: it.src || [] })) }))
    q.jobs = [blankJob()]
  } else {
    q.jobs = (q.jobs || []).map(jb => ({ kind: jb.kind, custom: tidy(jb.custom), area: tidy(jb.area), included: jobLines(jb).join('\n'), price: (jb.price || '').trim() }))
    q.sow = []; q.presets = {}; q.addons = []
  }
  return q
}

// ── the list ────────────────────────────────────────────────
export type PKey = 'draft' | 'sent' | 'revision' | 'accepted' | 'declined'
export function propState(p: Pick<Prop, 'status'>): { key: PKey; tag: string; tagCls: string } {
  if (p.status === 'sent') return { key: 'sent', tag: 'Awaiting reply', tagCls: 'tag sent' }
  if (p.status === 'accepted') return { key: 'accepted', tag: 'Accepted', tagCls: 'tag wt' }
  if (p.status === 'declined') return { key: 'declined', tag: 'Declined', tagCls: 'tag expiring' }
  if (p.status === 'revision') return { key: 'revision', tag: 'Revision requested', tagCls: 'tag expiring' }
  return { key: 'draft', tag: 'Draft', tagCls: 'tag draft' }
}
export const PROP_CHIPS: [PKey | 'all', string][] = [['all', 'All'], ['draft', 'Drafts'], ['sent', 'Awaiting reply'], ['revision', 'Revision requested'], ['accepted', 'Accepted'], ['declined', 'Declined']]
const P_ORDER: Record<PKey, number> = { revision: 0, sent: 1, draft: 2, accepted: 3, declined: 4 }
export function sortProps(list: Prop[]): Prop[] {
  return list.slice().sort((a, b) => P_ORDER[propState(a).key] - P_ORDER[propState(b).key] || (b.created || '').localeCompare(a.created || '') || b.ref.localeCompare(a.ref))
}
export function propTitle(p: Prop): string {
  return p.ptype === 'comm'
    ? 'Commercial proposal · ' + (money(p.price) ? fmt2(money(p.price)!) + '/clean, ' + (P_FREQ[p.freq] || P_FREQ.w1).word : 'price not set')
    : 'Specialist works · ' + ((p.jobs || []).map(jobName).filter(Boolean).join(', ') || 'service not chosen') + (propTotal(p) ? ' · ' + fmt2(propTotal(p)) : '')
}
export function propMeta(p: Prop): string {
  const k = propState(p).key, comm = p.ptype === 'comm'
  if (k === 'draft') return 'Ref ' + p.ref + ' · draft saved ' + dShort(p.created)
  if (k === 'sent') return 'Sent to ' + p.sentTo + ' on ' + dShort(p.sentAt) + ' · valid until ' + dShort(isoAdd(p.sentAt!, 30)) + ' · ' + p.ref
  if (k === 'accepted') {
    const signed = p.agr && p.agr.status === 'signed' ? p.agr : null
    return 'Accepted on ' + dShort(p.acceptedAt) + ' · ' + p.ref
      + (p.booked ? ' · works booked for ' + dShort(p.worksDate) + ' (their service agreement covers it)'
        : signed ? ' · agreement signed by ' + signed.signedBy + (comm ? (p.setupClientId ? ' · client set up' : ' · next: set them up as a client') : ' · works booked')
          : ' · agreement waiting for their signature')
  }
  if (k === 'revision') return 'Revision requested on ' + dShort(p.revisionAt) + ' · “' + p.revisionNote + '” · ' + p.ref
  return 'Declined on ' + dShort(p.declinedAt) + (p.reason ? ' · ' + p.reason : '') + (p.note ? ' · “' + p.note + '”' : '') + ' · ' + p.ref
}

// ── the document (preview, the client's page, the PDF) ──────
export interface PropDocView {
  isComm: boolean; kicker: string; ref: string; biz: string; contact: string; address: string; date: string
  coverH: string; coverSub: string; w1: string; w2: string; toc: { name: string; num: string }[]; howH: string
  how: { n: string; t: string; b: string }[]; scopeNav: string; scopeKick: string; freqLines: string[]
  groups: { num: string; heading: string; items: string[] }[]; jobs: { num: string; name: string; area: string; items: string[] }[]
  excl: string; terms: string[]; termsNote: string; priceKick: string; priceLines: string[]; price: string; per: string
  addons: { kick: string; desc: string; price: string }[]; steps: { n: string; t: string; b: string }[]
}
const num2 = (i: number) => (i < 9 ? '0' : '') + (i + 1)
export function propDoc(p: Pf & { sentAt?: string | null }, today: string, reqClient = false): PropDocView {
  const comm = p.ptype === 'comm', F = P_FREQ[p.freq] || P_FREQ.w1
  let excl = tidy(p.excl); if (excl && !/[.!]$/.test(excl)) excl += '.'
  const addons = comm ? (p.addons || []).filter(a => addName(a) && ADD_ADJ[a.freq]) : []
  const issue = p.sentAt || p.created || today
  const biz = tidy(p.biz)
  return {
    isComm: comm,
    kicker: comm ? 'Commercial cleaning proposal' : 'Specialist works proposal',
    ref: p.ref, biz: biz || 'Business name', contact: tidy(p.contact) || 'Contact name', address: tidy(p.address) || 'Site address', date: dLong(issue),
    coverH: comm ? 'A cleaner workplace, handled properly.' : 'Specialist cleaning, done properly.',
    coverSub: comm ? 'A proposal for the ongoing commercial cleaning of your premises, from a local team that takes pride in the detail.' : 'A proposal for specialist cleaning works at your premises, from a local team that takes pride in the detail.',
    w1: comm ? 'Thank you for the opportunity to put this proposal together for ' + (biz || 'your business') + '. A clean workplace shapes how your staff feel each morning and how your clients see your business the moment they walk in. We take that seriously.'
      : 'Thank you for the opportunity to put this proposal together for ' + (biz || 'your business') + '. Specialist work like this lifts the look and life of your floors and surfaces, and we take care to get it right the first time.',
    w2: comm ? 'The pages that follow introduce our team, how we work, and the standards we hold ourselves to. You will then find the scope of works we have prepared for your site, the key terms, and our pricing on the final page.'
      : 'The pages that follow introduce our team, how we work, and the standards we hold ourselves to. You will then find the works we have scoped for your site, the key terms, and our pricing on the final page.',
    toc: [['Who we are', '03'], ['Why clients choose Core', '04'], ['What we do', '05'], ['How we work', '06'], ['Trust, safety & insurance', '07'], [comm ? 'Your site & scope of works' : 'Your site & the works', '08'], ['Terms at a glance', '09'], ['Your investment', '10']].map(x => ({ name: x[0], num: x[1] })),
    howH: comm ? 'A simple process, from first visit to every visit.' : 'A simple process, from first look to final walk-through.',
    how: (comm ? [['Site walkthrough', 'We visit your premises, see how the space is used and note any areas that need special attention.'], ['Tailored scope', 'A written scope of works built for your site, at a frequency and time that suits your business.'], ['Checklist cleans', 'The same thorough result on the first clean and the fiftieth, following your site checklist.'], ['Ongoing review', 'We check in regularly and adjust the scope as your needs change.']]
      : [['Site inspection', 'We look at the areas, the surfaces and their condition before we price anything.'], ['Fixed quote', 'A written price for the works described, with no surprises on the day.'], ['The works', 'Carried out at a time that suits you, with the area protected and left tidy.'], ['Final check', 'We walk through the finished work with you, or send photos if you are off site.']]).map((x, i) => ({ n: String(i + 1), t: x[0], b: x[1] })),
    scopeNav: comm ? 'Scope of works' : 'The works', scopeKick: comm ? 'Your site & scope of works' : 'Your site & the works',
    freqLines: comm ? ['Clean — ' + F.short].concat(addons.map(a => addName(a) + ' — ' + ADD_SHORT[a.freq]))
      : [p.date2 ? 'Proposed date — ' + dLong(p.date2) : 'Date — to be agreed', 'Timing — ' + (P_WIN[p.window] || P_WIN.day)],
    groups: comm ? (p.sow || []).map(h => ({ heading: tidy(h.heading), items: h.items.map(it => tidy(it.text)).filter(Boolean) })).concat(addons.map(a => { const b = addBox(a); return { heading: b.heading, items: b.items.map(x => x.text) } })).map((g, i) => ({ num: num2(i), heading: g.heading, items: g.items })) : [],
    jobs: comm ? [] : (p.jobs || []).map((jb, i) => ({ num: num2(i), name: jobName(jb) || 'Service', area: tidy(jb.area), items: jobLines(jb) })),
    excl: excl || 'any item outside the scope listed above.',
    terms: comm ? [
      'This proposal is valid for 30 days from the date of issue and applies to the scope and price set out in this document.',
      'Scope is limited to the areas and items listed. Excessive soiling or work beyond scope may attract an additional charge, confirmed with you first.',
      'The Client provides clear, safe access to the site, with working power, water and lighting for the duration of each visit.',
      'Invoices are issued monthly and payment is due within 14 days. Late payment incurs a 10% late fee plus 2% monthly interest on the overdue balance.',
      'At least 24 hours’ notice is required to cancel or reschedule a visit. Less notice, or a lockout on arrival, incurs a fee of up to 100% of that visit.',
      'Once accepted, the service continues on a recurring basis until either party gives 14 days’ written notice.',
      'Any loss or damage must be reported in writing within 24 hours of a visit, with photos, so we can inspect and resolve it.',
      'Core Cleaning personnel may not be engaged directly outside this arrangement for 3 years from the start of service.',
    ] : [
      'This proposal is valid for 30 days from the date of issue and applies to the works and price set out in this document.',
      'The price covers the areas and condition described. If an area is larger or in a noticeably different condition on the day, we confirm any change with you before continuing.',
      'The Client provides clear, safe access to the area, with working power, water and lighting, and moves small items and valuables beforehand.',
      'The works are invoiced on completion and payment is due within 14 days. Late payment incurs a 10% late fee plus 2% monthly interest on the overdue balance.',
      'At least 24 hours’ notice is required to cancel or reschedule. Less notice, or a lockout on arrival, incurs a fee of up to 100% of the quoted price.',
      'Some marks, stains and wear are permanent. We tell you on the day if anything will not come out, and results on damaged surfaces cannot be guaranteed.',
      'Any loss or damage must be reported in writing within 24 hours of the works, with photos, so we can inspect and resolve it.',
      'Core Cleaning personnel may not be engaged directly outside this arrangement for 3 years from the date of the works.',
    ],
    termsNote: 'Full terms are set out in Core Cleaning’s Master Terms & Conditions (MTC‑CC‑2026), which apply to all services and are available on request. ' + (comm ? 'A formal service agreement is issued once this proposal is accepted.' : 'A short specialist works agreement is issued once this proposal is accepted.'),
    priceKick: comm ? 'Quoted price — ' + F.kick : 'Quoted price — specialist works',
    priceLines: comm ? [F.line + ', ' + (P_WHEN[p.when] || P_WHEN.after) + '.', 'Full scope of works as set out on page 08.', 'All figures in AUD, inclusive of GST.']
      : (p.jobs || []).map(jb => (jobName(jb) || 'Service') + ': ' + (money(jb.price) ? fmt2(money(jb.price)!) : '$0.00')).concat(['All figures in AUD, inclusive of GST.']),
    price: comm ? fmt2(money(p.price) || 0) : fmt2(propTotal(p)),
    per: comm ? '/clean' : 'total',
    addons: addons.map(a => { const nm = addName(a); return { kick: nm + ' — add-on', desc: tidy(a.desc) || ADD_ADJ[a.freq] + ' ' + nm.toLowerCase() + ', charged in addition to the regular clean.', price: fmt2(money(a.price) || 0) } }),
    steps: (comm ? [['Confirm', 'Reply to confirm you are happy with this proposal.'], ['Agreement & compliance', 'We issue your service agreement and compliance pack, and agree a start date.'], ['First clean', 'Your first clean is booked and your portal is set up.']]
      : reqClient ? [['Accept', 'Accept online. Your current agreement with us covers these works, so there’s nothing new to sign.'], ['Booked', 'We lock in the date and it shows in your client portal.'], ['The works', 'We complete the works and walk you through the result.']]
        : [['Confirm', 'Reply to confirm you are happy with this proposal.'], ['Works agreement', 'We send a short works agreement to sign and lock in the date.'], ['The works', 'We complete the works and walk you through the result.']]).map((x, i) => ({ n: String(i + 1), t: x[0], b: x[1] })),
  }
}

/** "12 Gympie Rd, Kedron QLD 4031" → parts for the New client form. */
export function splitAddress(a: string): { street: string; suburb: string; state: string; postcode: string } {
  const m = /^(.*?),\s*([^,]+?)\s+(QLD|NSW|ACT|VIC|TAS|SA|WA|NT)\s+(\d{4})$/i.exec(tidy(a))
  return m ? { street: m[1], suburb: m[2], state: m[3].toUpperCase(), postcode: m[4] } : { street: tidy(a), suburb: '', state: 'QLD', postcode: '' }
}

// ── references ──────────────────────────────────────────────
export const pad3 = (n: number) => String(n).padStart(3, '0')
export const quoteRef = (year: string, n: number) => `CC-${year}-CCQ${pad3(n)}`
export const agreeRefNew = (year: string, n: number) => `CC-${year}-CCA${pad3(n)}`
export function renewRef(ref: string): string { const m = /^(.*?)(?:-R(\d+))?$/.exec(ref || '')!; return m[1] + '-R' + ((+m[2] || 0) + 1) }

// ── agreements ──────────────────────────────────────────────
/** The proposal as it was accepted, copied onto the agreement. */
export interface PropSnap {
  ptype: PType; ref: string; biz: string; contact: string; email: string; address: string; acceptedAt: string
  freq: FreqKey; when: WhenKey; price: string; sow: { heading: string; items: { text: string }[] }[]; addons: Addon[]
  jobs: Job[]; date2: string; window: WinKey
}
/** A client's details, for an agreement made from their client record (locked when it's sent). */
export interface ClientSnap {
  name: string; contact: string; email: string; phone: string; address: string; premises: string; days: string[]; time: string
  sched: string; monthlyEx: number; access: string; scope: { heading: string; items: string[] }[]
}
export interface AgrSnap { prop?: PropSnap; client?: ClientSnap; clauses: Clause[] }

export function propSnap(p: Prop, today: string): PropSnap {
  const c = cleanProp(p)
  return {
    ptype: c.ptype, ref: p.ref, biz: c.biz, contact: c.contact, email: c.email || p.sentTo, address: c.address, acceptedAt: today,
    freq: c.freq, when: c.when, price: c.price,
    sow: c.ptype === 'comm' ? c.sow.map(h => ({ heading: h.heading, items: h.items.map(it => ({ text: it.text })) })) : [],
    addons: c.ptype === 'comm' ? c.addons.filter(a => addName(a) && ADD_ADJ[a.freq]) : [],
    jobs: c.ptype === 'spec' ? c.jobs : [], date2: c.date2, window: c.window,
  }
}

export interface Agr {
  id: string; atype: 'service' | 'spec'; ref: string; code: string; status: 'draft' | 'sent' | 'signed'
  clientId: string | null; proposalId: string | null; renewOf: string | null; client: string
  start: string | null; termMonths: number; snap: AgrSnap | null; details: SignDetails | null
  created: string; sentTo: string; sentAt: string | null; signedBy: string; signedAt: string | null; signedIp: string
  reqSentAt: string | null; portal: { email: string; first: string; sentAt: string; resentAt?: string } | null
}
export const AGR_COLS = 'id, atype, ref, code, status, client_id, proposal_id, renew_of, client_name, start_on, term_months, snap, details, created_on, sent_to, sent_at, signed_by, signed_at, signed_ip, req_sent_at, portal'
export function agrOf(r: any): Agr {
  return {
    id: r.id, atype: r.atype === 'spec' ? 'spec' : 'service', ref: r.ref, code: r.code, status: r.status,
    clientId: r.client_id || null, proposalId: r.proposal_id || null, renewOf: r.renew_of || null, client: str(r.client_name, 200),
    start: d10(r.start_on), termMonths: Number(r.term_months) || 0, snap: r.snap && typeof r.snap === 'object' ? r.snap : null,
    details: r.details && typeof r.details === 'object' ? r.details : null, created: d10(r.created_on) || '',
    sentTo: str(r.sent_to, 320), sentAt: d10(r.sent_at), signedBy: str(r.signed_by, 200), signedAt: d10(r.signed_at), signedIp: str(r.signed_ip, 100),
    reqSentAt: d10(r.req_sent_at), portal: r.portal && typeof r.portal === 'object' ? r.portal : null,
  }
}

export type DKey = 'draft' | 'sent' | 'signed' | 'expiring' | 'rolling' | 'filed'
export function agrState(d: Pick<Agr, 'status' | 'atype' | 'start' | 'termMonths'>, today: string): { key: DKey; tag: string; tagCls: string; end: string; left: number } {
  if (d.status === 'draft') return { key: 'draft', tag: 'Draft', tagCls: 'tag draft', end: '', left: 0 }
  if (d.status === 'sent') return { key: 'sent', tag: 'Awaiting signature', tagCls: 'tag sent', end: '', left: 0 }
  if (d.atype === 'spec' || !d.start || !d.termMonths) return { key: 'signed', tag: 'Signed', tagCls: 'tag wt', end: '', left: 9999 }
  const end = termEnd(d.start, d.termMonths), left = daysBetween(today, end)
  if (left < 0) return { key: 'rolling', tag: 'Rolling', tagCls: 'tag wt', end, left }
  if (left <= 60) return { key: 'expiring', tag: 'Term ends in ' + left + (left === 1 ? ' day' : ' days'), tagCls: 'tag expiring', end, left }
  return { key: 'signed', tag: 'Signed', tagCls: 'tag wt', end, left }
}
export const DOC_CHIPS: [DKey | 'all', string][] = [['all', 'All'], ['draft', 'Drafts'], ['sent', 'Awaiting signature'], ['signed', 'Signed'], ['expiring', 'Term ending soon'], ['filed', 'Other files']]
export const UPLOAD_KINDS = ['Signed agreement (from before the hub)', 'Proposal', 'Certificate of currency', 'Site induction', 'Other'] as const

// What the client fills in on the signing page.
export const AS_REQS: [string, string][] = [
  ['coc', 'Please send your Certificate of Currency'],
  ['pack', 'Please send your full compliance pack (SWMS, policies and insurance)'],
  ['induct', 'Your cleaners need to complete our site induction before starting'],
  ['police', 'Please send evidence of police checks for the assigned cleaners'],
  ['walk', 'Please call me to arrange a site walkthrough before the first clean'],
]
export const AS_REQ_SHORT: Record<string, string> = { coc: 'Certificate of Currency', pack: 'compliance pack', induct: 'site induction', police: 'police check evidence', walk: 'walkthrough call' }
export const AS_TIMES: [string, string][] = [['05:00', '5am'], ['06:00', '6am'], ['07:00', '7am'], ['08:00', '8am'], ['09:00', '9am'], ['12:00', '12pm'], ['15:00', '3pm'], ['16:00', '4pm'], ['17:00', '5pm'], ['17:30', '5:30pm'], ['18:00', '6pm'], ['19:00', '7pm'], ['20:00', '8pm']]
export const WDAYS: [string, string, string][] = [['mon', 'Mon', 'Monday'], ['tue', 'Tue', 'Tuesday'], ['wed', 'Wed', 'Wednesday'], ['thu', 'Thu', 'Thursday'], ['fri', 'Fri', 'Friday'], ['sat', 'Sat', 'Saturday'], ['sun', 'Sun', 'Sunday']]
const dayLabel = (k: string) => (WDAYS.find(x => x[0] === k) || [k, k])[1]

export function abnOk(a: string): boolean {
  const d = String(a || '').replace(/\s/g, '')
  if (!/^\d{11}$/.test(d)) return false
  const w = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19]
  let sum = 0
  for (let i = 0; i < 11; i++) sum += (parseInt(d.charAt(i), 10) - (i === 0 ? 1 : 0)) * w[i]
  return sum % 89 === 0
}
export function fmtAbn(a: string): string { const d = String(a || '').replace(/\s/g, ''); return d.length === 11 ? d.slice(0, 2) + ' ' + d.slice(2, 5) + ' ' + d.slice(5, 8) + ' ' + d.slice(8) : d }

export interface SignForm {
  name: string; position: string; phone: string; email: string; legal: string; abn: string; accounts: string; po: string
  address: string; siteName: string; sitePhone: string; access: string; start: string; time: string
  days: Record<string, boolean>; reqs: Record<string, boolean>; notes: string; sig: string; agree: boolean
}
export interface SignDetails {
  name: string; position: string; phone: string; email: string; legal: string; abn: string; accounts: string; po: string
  address: string; siteName: string; sitePhone: string; access: string; start: string; time: string; days: string[]; reqs: string[]; notes: string
}

/** Every check on the signing page, in the mock-up's order and words. Returns the error or the cleaned details. */
export function signCheck(f: SignForm, today: string, spec: boolean): { error: string } | { details: SignDetails } {
  const fail = (error: string) => ({ error })
  const nm = tidy(f.name), em = (f.email || '').trim(), acc = (f.accounts || '').trim(), ph = normPhone(f.phone || '')
  if (nm.length < 2 || nm.indexOf(' ') === -1) return fail('Enter your full name (first and last).')
  if (nm.length > 200) return fail('That name is too long.')
  if (tidy(f.position).length < 2) return fail('Enter your position, e.g. Practice Manager.')
  if (!ph) return fail('Enter a valid mobile or phone number, e.g. 0412 345 678.')
  if (!EMAIL_OK(em) || em.length > 320) return fail('Enter a valid email address.')
  if (tidy(f.legal).length < 2) return fail('Enter the business legal name.')
  if (tidy(f.abn) && !abnOk(f.abn)) return fail('That ABN doesn’t look right. It should be 11 digits, e.g. 51 824 753 556. Leave it empty if you’re not sure.')
  if (!EMAIL_OK(acc) || acc.length > 320) return fail('Enter a valid email for invoices.')
  if (tidy(f.address).length < 5) return fail('Enter the site address.')
  let sph = ''
  if (tidy(f.sitePhone)) { sph = normPhone(f.sitePhone) || ''; if (!sph) return fail('The on-site contact phone doesn’t look right.') }
  if (tidy(f.access).length < 5) return fail('Add the site access details, e.g. how the cleaners get in and any alarm.')
  if (!isIso(f.start)) return fail(spec ? 'Choose the works date.' : 'Choose your preferred first clean date.')
  if (f.start < today) return fail('That date is in the past. Choose a date from today.')
  if (tidy(f.sig).toLowerCase() !== nm.toLowerCase()) return fail('Type your full name to sign. It needs to match the name at the top (' + nm + ').')
  if (!f.agree) return fail('Tick the box to agree to the terms.')
  const cap = (s: string, n: number) => s.slice(0, n)
  return {
    details: {
      name: nm, position: cap(tidy(f.position), 120), phone: ph, email: em, legal: cap(tidy(f.legal), 200), abn: tidy(f.abn).replace(/\s/g, ''),
      accounts: acc, po: cap(tidy(f.po), 60), address: cap(tidy(f.address), 300), siteName: cap(tidy(f.siteName), 120), sitePhone: sph,
      access: cap((f.access || '').trim(), 2000), start: f.start, time: AS_TIMES.some(x => x[0] === f.time) ? f.time : '',
      days: spec ? [] : WDAYS.filter(x => f.days && f.days[x[0]]).map(x => x[0]),
      reqs: AS_REQS.filter(x => f.reqs && f.reqs[x[0]]).map(x => x[0]), notes: cap((f.notes || '').trim(), 2000),
    },
  }
}

export interface Part { k: string; v: string }
const CONTACT: Part = { k: 'Core Cleaning contact', v: 'Laith Humadi, Director, +61 407 026 360, admin@corecleaning.services' }
const PROVIDER: Part = { k: 'Provider', v: 'Core Cleaning, ABN 45 344 135 153' }

/** Particulars for an agreement made from an accepted commercial proposal (updates live as they fill in the details). */
export function partsFromProp(d: Pick<Agr, 'start' | 'termMonths'>, p: PropSnap, det: Partial<SignDetails> = {}): Part[] {
  const F = P_FREQ[p.freq] || P_FREQ.w1, start = det.start || d.start || ''
  const end = start ? termEnd(start, d.termMonths || 12) : ''
  const dayList = det.days && det.days.length ? det.days.map(dayLabel).join(', ') : ''
  const price = money(p.price) || 0
  const out: Part[] = [
    PROVIDER,
    { k: 'Client', v: (tidy(det.legal) || p.biz) + (det.abn ? ' (ABN ' + fmtAbn(det.abn) + ')' : '') },
    { k: 'Premises', v: tidy(det.address) || p.address },
    { k: 'Services', v: 'Commercial cleaning, ' + F.word + ', ' + (P_WHEN[p.when] || P_WHEN.after) + ', as set out in Schedule 1' },
  ]
  if (dayList || det.time) out.push({ k: 'Preferred days and time', v: [dayList, det.time ? 'starting about ' + t12s(det.time) : ''].filter(Boolean).join(', ') })
  out.push({ k: 'Commencement date', v: start ? dLong(start) : 'To be confirmed' })
  out.push({ k: 'Initial term', v: (d.termMonths || 12) + ' months' + (end ? ' (to ' + dLong(end) + ')' : '') + ', then rolling until ended under clause 14' })
  out.push({ k: 'Service fee', v: fmt2(price) + ' per clean incl GST (' + fmt2(price / 1.1) + ' ex GST)' })
  for (const a of p.addons || []) { const nm = addName(a), pa = money(a.price) || 0; if (nm) out.push({ k: 'Add-on: ' + nm, v: ADD_ADJ[a.freq] + ', ' + fmt2(pa) + ' incl GST each time' }) }
  out.push({ k: 'Payment terms', v: 'Invoiced monthly, due within 14 days' + (det.po ? '. Purchase order ' + det.po : '') })
  if (det.accounts) out.push({ k: 'Invoices sent to', v: det.accounts })
  out.push({ k: 'Accepted proposal', v: p.ref + (p.acceptedAt ? ', accepted ' + dLong(p.acceptedAt) : '') })
  out.push(CONTACT)
  return out
}
/** Particulars for a specialist works agreement. */
export function specParts(d: Pick<Agr, 'start' | 'client'>, p: PropSnap | null, acceptedBy = ''): Part[] {
  const tot = p ? propTotal(p) : 0
  const names = p ? (p.jobs || []).map(jobName).join(', ') : 'As per the accepted proposal'
  const win: Record<string, string> = { day: 'during the day', after: 'after hours', weekend: 'weekend' }
  return [
    PROVIDER,
    { k: 'Client', v: d.client },
    { k: 'Premises', v: p ? p.address : 'To be confirmed' },
    { k: 'Works', v: names },
    { k: 'Works date', v: d.start ? dLong(d.start) + (p && p.window ? ', ' + win[p.window] : '') : 'To be confirmed' },
    { k: 'Works price', v: tot ? fmt$(tot) + ' inc GST (' + fmt$(Math.round(tot / 1.1 * 100) / 100) + ' ex GST)' : 'As per the accepted proposal' },
    { k: 'Payment terms', v: 'Invoiced on completion, due within 14 days' },
    { k: 'Accepted proposal', v: p ? p.ref + ', accepted' + (acceptedBy ? ' by ' + acceptedBy : '') + ' on ' + dLong(p.acceptedAt) : '' },
    CONTACT,
  ]
}
/** Particulars for an agreement made from a client record. */
export function clientParts(d: Pick<Agr, 'start' | 'termMonths' | 'client'>, c: ClientSnap | null, det: Partial<SignDetails> = {}): Part[] {
  const end = (det.start || d.start) ? termEnd((det.start || d.start)!, d.termMonths || 12) : ''
  const ex = c ? c.monthlyEx : 0
  const start = det.start || d.start || ''
  return [
    PROVIDER,
    { k: 'Client', v: (tidy(det.legal) || d.client) + (det.abn ? ' (ABN ' + fmtAbn(det.abn) + ')' : '') },
    { k: 'Premises', v: tidy(det.address) || (c && c.premises) || 'To be confirmed' },
    { k: 'Cleaning days', v: (c && c.sched) || 'To be confirmed' },
    { k: 'Commencement date', v: dLong(start) || 'To be confirmed' },
    { k: 'Initial term', v: (d.termMonths || 12) + ' months' + (end ? ' (to ' + dLong(end) + '), then rolling until ended under clause 14' : '') },
    { k: 'Service fee', v: ex ? fmt$(Math.round(ex * 100) / 100) + ' a month ex GST (' + fmt$(Math.round(ex * 1.1)) + ' inc GST)' : 'As per the accepted proposal' },
    { k: 'Payment terms', v: 'Invoiced monthly, due within 14 days' + (det.po ? '. Purchase order ' + det.po : '') },
    ...(det.accounts ? [{ k: 'Invoices sent to', v: det.accounts }] : []),
    CONTACT,
  ]
}
export function agrParts(d: Agr, det: Partial<SignDetails> | null, clientSnap: ClientSnap | null): Part[] {
  const p = d.snap?.prop || null
  if (d.atype === 'spec') return specParts({ start: det?.start || d.start, client: d.client }, p, d.signedBy)
  if (p) return partsFromProp(d, p, det || {})
  return clientParts(d, d.snap?.client || clientSnap, det || {})
}
export function agrScope(d: Agr, clientSnap: ClientSnap | null): { heading: string; items: string[] }[] {
  const p = d.snap?.prop
  if (d.atype === 'spec') return p ? (p.jobs || []).map(jb => ({ heading: jobName(jb) + (jb.area ? ': ' + jb.area : ''), items: jobLines(jb) })) : []
  if (p) return p.sow.map(h => ({ heading: h.heading, items: h.items.map(it => it.text) })).concat((p.addons || []).map(a => { const b = addBox(a); return { heading: b.heading, items: b.items.map(x => x.text) } }))
  const c = d.snap?.client || clientSnap
  return c ? c.scope : []
}
export const agrClauses = (d: Pick<Agr, 'atype' | 'snap'>): Clause[] => (d.snap?.clauses?.length ? d.snap.clauses : d.atype === 'spec' ? SPEC_CLAUSES : COMM_CLAUSES)
export const agrTitle = (d: Pick<Agr, 'atype'>) => (d.atype === 'spec' ? 'Specialist works agreement' : 'Service agreement')

/** What the client filled in, for the agreement viewer. */
export function detailsList(det: SignDetails | null): Part[] {
  if (!det) return []
  return ([
    ['Signed by', det.name + (det.position ? ', ' + det.position : '')], ['Mobile', det.phone], ['Email', det.email], ['Business legal name', det.legal], ['ABN', det.abn ? fmtAbn(det.abn) : ''],
    ['Invoices to', det.accounts], ['Purchase order', det.po], ['Site address', det.address], ['On-site contact', [det.siteName, det.sitePhone].filter(Boolean).join(', ')],
    ['Site access', det.access], ['Preferred start', det.start ? dLong(det.start) : ''], ['Preferred days', (det.days || []).map(dayLabel).join(', ')],
    ['Preferred time', det.time ? t12s(det.time) : ''], ['They asked for', (det.reqs || []).map(k => AS_REQ_SHORT[k]).join(', ')], ['Notes', det.notes],
  ] as [string, string][]).filter(x => x[1]).map(x => ({ k: x[0], v: x[1] }))
}

/** "Dr Megan Clarke" → "Megan": the starter password and the hello in the welcome email. */
export function portalFirst(name: string): string {
  const p = String(name || '').trim().split(/\s+/).filter(w => !/^(dr|mr|mrs|ms|miss|mx|prof)\.?$/i.test(w))
  const f = p[0] || ''
  return f ? f.charAt(0).toUpperCase() + f.slice(1).toLowerCase() : 'Welcome'
}

/** The agreement document's words (cover, particulars, Schedule 1, terms), from the agreement and, while signing,
 *  what the client has typed so far. */
export function agView(d: Agr, today: string, det: Partial<SignDetails> | null, clientSnap: ClientSnap | null = null) {
  const spec = d.atype === 'spec', p = d.snap?.prop || null, c = d.snap?.client || clientSnap
  return {
    kicker: agrTitle(d), ref: d.ref, biz: d.client,
    address: tidy(det?.address) || p?.address || c?.address || '',
    coverH: spec ? 'Specialist works agreement.' : 'Service agreement.',
    coverSub: p ? `The agreement for the ${spec ? 'works' : 'cleaning services'} in proposal ${p.ref}. Add your details, read the terms and sign at the end.` : 'Your agreement for cleaning services with Core Cleaning. Add your details, read the terms and sign at the end.',
    date: dLong(d.sentAt || d.created || today),
    parts: agrParts(d, det, clientSnap), fromProp: !!p, scopeH: spec ? 'The works.' : 'Scope of works.', scope: agrScope(d, clientSnap), clauses: agrClauses(d),
  }
}

/** What the signing form starts with: from the accepted proposal, or the client's record. */
export function signPrefill(d: Agr, today: string): SignForm {
  const p = d.snap?.prop, c = d.snap?.client
  const f: SignForm = { name: '', position: '', phone: '', email: '', legal: d.client, abn: '', accounts: '', po: '', address: '', siteName: '', sitePhone: '', access: '', start: '', time: '', days: {}, reqs: {}, notes: '', sig: '', agree: false }
  if (p) {
    f.name = p.contact || ''; f.email = p.email || d.sentTo || ''; f.address = p.address || ''
    const s = d.start || p.date2 || ''
    f.start = s && s >= today ? s : ''
    if (p.freq === 'd5') f.days = { mon: true, tue: true, wed: true, thu: true, fri: true }
  } else if (c) {
    f.name = c.contact || ''; f.email = c.email || d.sentTo || ''; f.phone = c.phone || ''; f.access = c.access || ''; f.address = c.address || ''
    f.start = d.start && d.start >= today ? d.start : ''
    for (const k of c.days || []) f.days[k] = true
    f.time = AS_TIMES.some(x => x[0] === c.time) ? c.time : ''
  }
  f.accounts = f.email
  return f
}

/** Set up as client: the new client form, filled in from the accepted proposal and what they signed with. */
export function ncFromProp(p: Prop, det: Partial<SignDetails> | null, today: string) {
  const d = det || {}
  const ad = splitAddress(d.address || p.address)
  const ex = (v: string) => { const n = money(v) || 0; return n ? String(Math.round(n / 1.1 * 100) / 100) : '' }
  const days: Record<string, boolean> = {}
  if (d.days && d.days.length) for (const k of d.days) days[k] = true
  else if (p.freq === 'd5') for (const k of ['mon', 'tue', 'wed', 'thu', 'fri']) days[k] = true
  const sv = {
    days, every: p.freq === 'f1' ? 'fortnightly' : 'weekly', start: d.time || '', finish: '', first: d.start && d.start >= today ? d.start : '',
    cost: '', price: ex(p.price), cleaners: [] as string[], access: d.access || '',
    extras: (p.addons || []).filter(a => addName(a) && ADD_ADJ[a.freq]).map(a => ({ kind: a.kind, custom: a.custom || '', freq: a.freq, price: ex(a.price), cost: '' })),
  }
  const blank = { days: {}, every: 'weekly', start: '', finish: '', first: '', cost: '', price: '', cleaners: [] as string[], access: '', extras: [] }
  const site = () => ({ name: '', street: '', suburb: '', postcode: '' })
  return {
    biz: p.biz, contact: d.name || p.contact, phone: d.phone || '', email: d.email || p.email || p.sentTo || '',
    street: ad.street, suburb: ad.suburb, postcode: ad.postcode, state: ad.state || 'QLD', siteType: 'single' as const, sites: [site(), site()], svcs: [sv, blank],
  }
}
