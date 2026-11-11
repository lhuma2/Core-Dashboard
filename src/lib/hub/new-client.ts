// New client form: the state, the money lines and every check, ported from the mock-up (Main.dc.html ncSave).
// Pure functions, used by the form for instant messages and again by the server action before saving.

import { cleansPerMonth, freqText, currentStatus, ADDON_PER_YEAR, type AddonFreq } from './figures'

export const DAYS = [['mon', 'Mon', 'Monday'], ['tue', 'Tue', 'Tuesday'], ['wed', 'Wed', 'Wednesday'], ['thu', 'Thu', 'Thursday'], ['fri', 'Fri', 'Friday'], ['sat', 'Sat', 'Saturday'], ['sun', 'Sun', 'Sunday']] as const
export type DayKey = (typeof DAYS)[number][0]
export const STATES = ['QLD', 'NSW', 'ACT', 'VIC', 'TAS', 'SA', 'WA', 'NT'] as const
export const EVERY_OPTS = [['weekly', 'Every week'], ['fortnightly', 'Every fortnight'], ['monthly', 'Once a month']] as const
export const EXTRA_KINDS = ['Internal windows', 'Internal & external windows', 'Pressure washing', 'Vinyl strip and seal', 'Carpet steam clean', 'Custom'] as const
export const EXTRA_FREQS = [['once', 'One-off'], ['weekly', 'Weekly'], ['fortnightly', 'Fortnightly'], ['monthly', 'Monthly'], ['quarterly', 'Quarterly'], ['six_monthly', 'Every 6 months'], ['yearly', 'Yearly']] as const
const MAX_SITES = 20
const MAX_EXTRAS = 10

export interface NcExtra { kind: string; custom: string; freq: string; price: string; cost: string }
export interface NcSvc { days: Partial<Record<DayKey, boolean>>; every: string; start: string; finish: string; first: string; cost: string; price: string; cleaners: string[]; access: string; extras: NcExtra[] }
export interface NcSite { name: string; street: string; suburb: string; postcode: string }
export interface NcForm { biz: string; contact: string; phone: string; email: string; street: string; suburb: string; postcode: string; state: string; siteType: 'single' | 'multi'; sites: NcSite[]; svcs: NcSvc[] }

export const blankSite = (): NcSite => ({ name: '', street: '', suburb: '', postcode: '' })
export const blankSvc = (): NcSvc => ({ days: {}, every: 'weekly', start: '', finish: '', first: '', cost: '', price: '', cleaners: [], access: '', extras: [] })
export const blankExtra = (): NcExtra => ({ kind: '', custom: '', freq: '', price: '', cost: '' })
export const blankNc = (): NcForm => ({ biz: '', contact: '', phone: '', email: '', street: '', suburb: '', postcode: '', state: 'QLD', siteType: 'single', sites: [blankSite(), blankSite()], svcs: [blankSvc(), blankSvc()] })
export { MAX_SITES, MAX_EXTRAS }

const STATE_PC: Record<string, [number, number][]> = {
  QLD: [[4000, 4999], [9000, 9999]],
  NSW: [[1000, 2599], [2620, 2899], [2921, 2999]],
  ACT: [[200, 299], [2600, 2619], [2900, 2920]],
  VIC: [[3000, 3999], [8000, 8999]],
  TAS: [[7000, 7999]],
  SA: [[5000, 5999]],
  WA: [[6000, 6999]],
  NT: [[800, 999]],
}
export function pcFits(pc: string, state: string): boolean { const n = parseInt(pc, 10); return (STATE_PC[state] ?? []).some(([a, b]) => n >= a && n <= b) }

/** Australian phone in a standard layout, or null if it isn't a valid number. */
export function normPhone(p: string): string | null {
  let d = (p || '').replace(/[^0-9+]/g, '')
  if (d.indexOf('+61') === 0) d = '0' + d.slice(3); else if (/^61\d{9}$/.test(d)) d = '0' + d.slice(2)
  d = d.replace(/\+/g, '')
  if (/^0[2378]\d{8}$/.test(d)) return d.slice(0, 2) + ' ' + d.slice(2, 6) + ' ' + d.slice(6)
  if (/^04\d{8}$/.test(d)) return d.slice(0, 4) + ' ' + d.slice(4, 7) + ' ' + d.slice(7)
  if (/^1[38]00\d{6}$/.test(d)) return d.slice(0, 4) + ' ' + d.slice(4, 7) + ' ' + d.slice(7)
  if (/^13\d{4}$/.test(d)) return d.slice(0, 2) + ' ' + d.slice(2, 4) + ' ' + d.slice(4)
  return null
}

/** "$120", "120.50", "1,200" → number above 0, else null. */
export function money(v: unknown): number | null {
  const t = String(v == null ? '' : v).replace(/[$,\s]/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null
  const n = parseFloat(t)
  return n > 0 ? n : null
}
export function fmt$(n: number): string {
  const r = Math.round(n * 100) / 100, whole = Math.floor(r), cents = Math.round((r - whole) * 100)
  return '$' + whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (cents ? '.' + (cents < 10 ? '0' : '') + cents : '')
}
export function time12(t: string): string {
  if (!/^\d{2}:\d{2}$/.test(t || '')) return ''
  let h = parseInt(t.slice(0, 2), 10)
  const m = t.slice(3), ap = h >= 12 ? 'pm' : 'am'
  h = h % 12 || 12
  return `${h}:${m} ${ap}`
}
export const dayKeys = (sv: NcSvc): DayKey[] => DAYS.filter(d => sv.days[d[0]]).map(d => d[0])
const PER_MONTH: Record<string, number> = { weekly: 52 / 12, fortnightly: 26 / 12, monthly: 1 }
const DOW_KEY = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

/** Checks the how-often choice against the chosen days and the date the pattern counts from. */
export function everyErr(who: string, every: string, keys: string[], pat: string, patLabel: string): string {
  if (!(every in PER_MONTH)) return `${who}: choose how often it’s cleaned.`
  if (every === 'weekly') return ''
  if (every === 'monthly' && keys.length !== 1) return `${who}: a monthly clean is on one day. Pick just one day.`
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pat || '')) return `${who}: add the ${patLabel}. It sets which ${every === 'monthly' ? 'week of the month' : 'weeks'} they’re cleaned.`
  const pk = DOW_KEY[new Date(Date.UTC(+pat.slice(0, 4), +pat.slice(5, 7) - 1, +pat.slice(8, 10))).getUTCDay()]
  if (!keys.includes(pk)) return `${who}: the ${patLabel} is a ${DAYS.find(d => d[0] === pk)![2]}, which isn’t one of the cleaning days. Pick a date on a cleaning day.`
  return ''
}

export interface MoneyLine { text: string; cls: string }
const health = (pct: number) => (pct >= 30 ? 'good' : pct >= 20 ? 'watch' : 'low')

export function svcMoney(sv: NcSvc): MoneyLine | null {
  const cost = money(sv.cost), price = money(sv.price), n = dayKeys(sv).length
  if (!cost || !price) return null
  const per = price - cost, pct = Math.round((per / price) * 100)
  if (per <= 0) return { text: `The client price is not more than your cleaner cost. You would lose ${fmt$(-per)} a visit.`, cls: 'money h low' }
  return {
    text: `Margin ${fmt$(per)} a visit (${pct}%).` + (n ? ` About ${fmt$(Math.round(price * n * (PER_MONTH[sv.every] ?? PER_MONTH.weekly)))} a month from the client, ex GST.` : ''),
    cls: 'money h ' + health(pct),
  }
}

export function extraMoney(ex: NcExtra): MoneyLine | null {
  const pr = money(ex.price), co = money(ex.cost)
  if (!pr || !co) return null
  const per = pr - co, pct = Math.round((per / pr) * 100)
  if (per <= 0) return { text: `Your charge is not more than the cleaner cost. You would lose ${fmt$(-per)} a visit.`, cls: 'money h low' }
  const py = ADDON_PER_YEAR[ex.freq as AddonFreq]
  return {
    text: `Margin ${fmt$(per)} a visit (${pct}%).` + (py ? ` About ${fmt$(Math.round((pr * py) / 12))} a month from the client, ex GST.` : ex.freq === 'once' ? ' One-off, so it isn’t counted in the monthly total.' : ''),
    cls: 'money h ' + health(pct),
  }
}

export const extraName = (ex: NcExtra) => (ex.kind === 'Custom' ? (ex.custom || '').trim().replace(/\s+/g, ' ') : ex.kind)

export function svcSummary(sv: NcSvc): string {
  const n = dayKeys(sv).length
  const timeTxt = time12(sv.start) + (sv.finish && time12(sv.finish) ? ' to ' + time12(sv.finish) : '')
  return n ? freqText(n, sv.every) + (timeTxt ? ', ' + timeTxt : '') : 'Pick the days above'
}

/** What the database save function takes. */
export interface NcPayload {
  business_name: string; contact_name: string; contact_phone: string; contact_email: string
  street: string; suburb: string; postcode: string; state: string; multi: boolean
  services: {
    site: NcSite | null; days: DayKey[]; every: string; first_clean: string; start_time: string; finish_time: string
    price: number; cost: number; access: string; cleaners: string[]
    addons: { name: string; freq: string; price: number; cost: number }[]
  }[]
}

export type NcResult = { ok: false; error: string } | { ok: true; payload: NcPayload; toast: string }

/**
 * Every check from the mock-up, in the same order, with the same words.
 * team: cleaners that exist, with whether they've signed the pack. existing: current commercial clients.
 */
export function validateNewClient(
  n: NcForm,
  today: string,
  team: { id: string; signed: boolean }[],
  existing: { name: string; status?: string | null; resume_on?: string | null }[],
): NcResult {
  const t = (x: string) => (x || '').trim().replace(/\s+/g, ' ')
  const fail = (error: string): NcResult => ({ ok: false, error })
  const biz = t(n.biz), contact = t(n.contact), email = (n.email || '').trim(), street = t(n.street), suburb = t(n.suburb), pc = (n.postcode || '').trim()
  if (!STATES.includes(n.state as (typeof STATES)[number])) return fail('Choose the state.')
  if (biz.length < 2) return fail('Enter the business name.')
  if (biz.length > 200) return fail('The business name is too long.')
  const dup = existing.find(c => c.name.trim().replace(/\s+/g, ' ').toLowerCase() === biz.toLowerCase())
  if (dup) {
    const s = currentStatus(dup, today)
    return fail(s === 'active' ? `${biz} is already one of your clients.` : `${biz} is under ${s === 'ended' ? 'Ended' : 'Paused'} clients. Open them there and ${s === 'ended' ? 'reactivate' : 'resume'} them instead, so their history stays together.`)
  }
  let phone = ''
  if (t(n.phone)) { const p = normPhone(n.phone); if (!p) return fail('That phone number doesn’t look right. Use 10 digits, e.g. 07 3123 4567 or 0412 345 678.'); phone = p }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('That email address doesn’t look right.')
  if (pc && !/^\d{4}$/.test(pc)) return fail('Postcodes have 4 digits.')
  if (pc && !pcFits(pc, n.state)) return fail(`Postcode ${pc} isn’t in ${n.state}. Check the postcode or the state.`)

  const multi = n.siteType === 'multi'
  const sites: NcSite[] = []
  if (multi) {
    if (n.sites.length < 2 || n.sites.length > MAX_SITES || n.svcs.length !== n.sites.length) return fail('Add between 2 and 20 sites.')
    for (let i = 0; i < n.sites.length; i++) {
      const x = n.sites[i], label = `Site ${i + 1}`
      const sn = t(x.name), ss = t(x.street), su = t(x.suburb), sp = (x.postcode || '').trim()
      if (!sn || !ss || !su) return fail(`${label} needs a name, street address and suburb.`)
      if (sp && !/^\d{4}$/.test(sp)) return fail(`${label}: postcodes have 4 digits.`)
      if (sites.some(y => y.name.toLowerCase() === sn.toLowerCase())) return fail(`Two sites are both called ${sn}. Give each site its own name.`)
      sites.push({ name: sn, street: ss, suburb: su, postcode: sp })
    }
  }

  const idx = multi ? n.sites.map((_, j) => j) : [0]
  const services: NcPayload['services'] = []
  let monthly = 0, monthlyCost = 0
  const freqs: string[] = []
  for (const k of idx) {
    const sv = n.svcs[k] ?? blankSvc()
    const who = multi ? `Site ${k + 1}` + (sites[k] ? ` (${sites[k].name})` : '') : 'Service details'
    const keys = dayKeys(sv)
    if (!keys.length) return fail(`${who}: pick at least one cleaning day.`)
    if (!/^\d{2}:\d{2}$/.test(sv.start || '')) return fail(`${who}: add a start time.`)
    if (sv.finish && !/^\d{2}:\d{2}$/.test(sv.finish)) return fail(`${who}: the finish time isn’t valid.`)
    if (sv.finish && sv.finish <= sv.start) return fail(`${who}: the finish time must be after the start time.`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sv.first || '')) return fail(`${who}: add the first clean date.`)
    if (sv.first < today) return fail(`${who}: the first clean date is in the past.`)
    const ev = everyErr(who, sv.every || 'weekly', keys, sv.first, 'first clean date')
    if (ev) return fail(ev)
    const cst = money(sv.cost), prc = money(sv.price)
    if (!cst) return fail(`${who}: enter your cleaner cost per visit as a dollar amount, e.g. 120 or 120.50.`)
    if (!prc) return fail(`${who}: enter the client price per visit as a dollar amount, e.g. 180.`)
    if (prc <= cst) return fail(`${who}: the client price (${fmt$(prc)}) is not more than your cleaner cost (${fmt$(cst)}). Check the two prices.`)
    if (sv.cleaners.some(id => !team.some(x => x.id === id && x.signed))) return fail(`${who}: one of the chosen cleaners can’t be assigned. Remove them and choose again.`)
    if ((sv.access || '').length > 2000) return fail(`${who}: the access details are too long. Keep them under 2,000 characters.`)
    if ((sv.extras || []).length > MAX_EXTRAS) return fail(`${who}: that’s more additional services than one site can have (10).`)
    const addons: NcPayload['services'][number]['addons'] = []
    for (let e = 0; e < (sv.extras || []).length; e++) {
      const ex = sv.extras[e], exn = `additional service ${e + 1}`
      if (!ex.kind) return fail(`${who}: choose which service ${exn} is, or remove it.`)
      const nm = extraName(ex)
      if (!nm) return fail(`${who}: give the custom service a name.`)
      if (nm.length > 200) return fail(`${who}: the custom service name is too long.`)
      if (!ex.freq || !(ex.freq in ADDON_PER_YEAR)) return fail(`${who}: choose how often ${nm} happens.`)
      const p = money(ex.price), c = money(ex.cost)
      if (!p) return fail(`${who}: enter your charge per visit for ${nm}, e.g. 350.`)
      if (!c) return fail(`${who}: enter the cleaner cost per visit for ${nm}, e.g. 220.`)
      if (p <= c) return fail(`${who}: your charge for ${nm} (${fmt$(p)}) is not more than the cleaner cost (${fmt$(c)}).`)
      addons.push({ name: nm, freq: ex.freq, price: p, cost: c })
    }
    const every = sv.every || 'weekly'
    const cpm = cleansPerMonth({ days: keys, every })
    monthly += prc * cpm; monthlyCost += cst * cpm
    for (const a of addons) { const py = ADDON_PER_YEAR[a.freq as AddonFreq] ?? 0; monthly += (a.price * py) / 12; monthlyCost += (a.cost * py) / 12 }
    freqs.push(freqText(keys.length, every))
    services.push({
      site: multi ? sites[k] : null, days: keys, every, first_clean: sv.first, start_time: sv.start, finish_time: sv.finish || '',
      price: prc, cost: cst, access: (sv.access || '').trim(), cleaners: Array.from(new Set(sv.cleaners)), addons,
    })
  }
  const mpct = Math.round(((monthly - monthlyCost) / monthly) * 100)
  return {
    ok: true,
    payload: { business_name: biz, contact_name: contact, contact_phone: phone, contact_email: email, street, suburb, postcode: pc, state: n.state, multi, services },
    toast: `Added ${biz}${sites.length ? ` with ${sites.length} sites.` : '.'} Monthly ${fmt$(Math.round(monthly))} ex GST, ${mpct}% margin.`,
  }
}
