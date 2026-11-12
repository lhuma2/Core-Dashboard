// Residential clients ("homes"): states, schedules and the words the list and client page show. Same rules as the
// finished mock-up (rState, homeOn, homeNext, statusMeta, moneyLine).
import { cleansPerMonth } from './figures'
import { isoAdd, offOn, onCadence, longDate, t12, CAL_DOW } from './timetable'
import { cash, cash2, dLong, dShort } from './home-quotes'
import { addr, freqLong, homeText, type HomeLike } from './home-agreements'

export interface Home extends HomeLike {
  id: string; phone: string | null; email: string | null; status: 'active' | 'paused' | 'ended'
  paused_from: string | null; resume_on: string | null; ended_on: string | null; done: boolean; cancelled: boolean
  finish_time: string | null; cost: number; cleaner_id: string | null; notes: string | null; division: 'res' | 'eol'
}
export interface History { date: string; text: string }
export const HOME_COLS = 'id, division, name, phone, email, street, suburb, state, postcode, kind, every, days, anchor, first_clean, start_time, finish_time, price, cost, cleaner_id, beds, baths, carpet_rooms, hallways, notes, status, paused_from, resume_on, ended_on, done, cancelled, windows_price, windows_freq'

const d10 = (v: any) => (v ? String(v).slice(0, 10) : null)
const t5 = (v: any) => (v ? String(v).slice(0, 5) : null)
export function homeOf(r: any): Home {
  return {
    ...r, price: Number(r.price) || 0, cost: Number(r.cost) || 0, windows_price: r.windows_price == null ? null : Number(r.windows_price),
    days: r.days || [], anchor: d10(r.anchor), first_clean: d10(r.first_clean), paused_from: d10(r.paused_from), resume_on: d10(r.resume_on), ended_on: d10(r.ended_on),
    start_time: t5(r.start_time), finish_time: t5(r.finish_time), beds: r.beds ?? 0, baths: r.baths ?? 0, carpet_rooms: r.carpet_rooms ?? 0, hallways: r.hallways ?? 0,
  }
}

export type RState = 'active' | 'starting' | 'paused' | 'ended' | 'booked' | 'overdue' | 'done' | 'cancelled'
export const STATE_TXT: Record<RState, string> = { active: 'Active', starting: 'Starting', paused: 'Paused', ended: 'Ended', booked: 'Booked', overdue: 'Mark done', done: 'Done', cancelled: 'Cancelled' }
export const STATE_CLS: Record<RState, string> = { active: 'tag wt', starting: 'tag sent', paused: 'tag fu', ended: 'tag draft', booked: 'tag sent', overdue: 'tag warn', done: 'tag wt', cancelled: 'tag draft' }

/** Recurring: active, starting, paused or ended. One-off: booked, overdue (date passed, not marked done), done or cancelled. */
export function rState(h: Home, today: string): RState {
  if (h.kind === 'oneoff') return h.cancelled ? 'cancelled' : h.done ? 'done' : (h.first_clean || '') < today ? 'overdue' : 'booked'
  let s: RState = h.status || 'active'
  if (s === 'paused' && h.resume_on && h.resume_on <= today) s = 'active'
  if (s === 'active' && h.first_clean && h.first_clean > today) return 'starting'
  return s
}
export const rFinished = (h: Home, today: string) => ['ended', 'done', 'cancelled'].includes(rState(h, today))

/** Does this home have a clean on this date? */
export function homeOn(h: Home, iso: string): boolean {
  if (h.kind === 'oneoff') return !h.cancelled && h.first_clean === iso
  const dw = CAL_DOW[new Date(iso + 'T00:00:00Z').getUTCDay()]
  if (!(h.days || []).includes(dw)) return false
  if (h.first_clean && iso < h.first_clean) return false
  if (offOn(h, iso)) return false
  return onCadence({ every: h.every, anchor: h.anchor, first: h.first_clean }, iso)
}
export function homeNext(h: Home, from: string, n = 1): string[] {
  if (h.kind === 'oneoff') return !h.cancelled && !h.done && h.first_clean ? [h.first_clean] : []
  const out: string[] = []
  const d = h.first_clean && h.first_clean > from ? h.first_clean : from
  for (let i = 0; i < 400 && out.length < n; i++) {
    const iso = isoAdd(d, i)
    if (h.status === 'ended' && h.ended_on && iso > h.ended_on) break
    if (homeOn(h, iso)) out.push(iso)
  }
  return out
}
export const perMonth = (h: Home) => (h.kind === 'oneoff' ? 1 : cleansPerMonth({ days: h.days, every: h.every }))

const R_EVERY: Record<string, string> = { weekly: 'Every week', fortnightly: 'Every fortnight', monthly: 'Once a month' }
const DAY3: Record<string, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' }
const ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const joinAnd = (a: string[]) => (a.length <= 1 ? a[0] || '' : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1])
export function schedText(h: Home): string {
  if (h.kind === 'oneoff') return 'One-off, ' + (h.first_clean ? dShort(h.first_clean) : 'no date')
  const ds = ORDER.filter(d => (h.days || []).includes(d)).map(d => DAY3[d])
  return (R_EVERY[h.every || 'weekly'] || 'Every week') + ', ' + joinAnd(ds) + (h.start_time ? ' ' + t12(h.start_time) : '')
}
export function timeText(h: Home): string { return h.start_time ? t12(h.start_time) + (h.finish_time ? ' to ' + t12(h.finish_time) : '') : 'No time set' }
export function statusMeta(h: Home, today: string): string {
  const s = rState(h, today)
  if (s === 'paused') return 'Paused' + (h.resume_on ? ' until ' + dShort(h.resume_on) : '')
  if (s === 'ended') return h.ended_on ? (h.ended_on >= today ? 'Ending, last clean ' + dShort(h.ended_on) : 'Ended ' + dShort(h.ended_on)) : 'Ended'
  if (s === 'starting') return 'Starts ' + dShort(h.first_clean)
  if (s === 'overdue') return 'Was on ' + dShort(h.first_clean) + ', mark it done'
  if (s === 'done') return 'Done ' + dShort(h.first_clean)
  if (s === 'cancelled') return 'Cancelled'
  const nx = homeNext(h, today, 1)[0]
  return nx ? 'Next ' + (nx === today ? 'today' : dShort(nx)) : ''
}
/** "Ex GST $162.00 · cleaner $120.00 · profit $42.00 a clean (26%)", coloured by margin. */
export function moneyLine(price: number, cost: number): { text: string; cls: string; pct: number } | null {
  if (!(price > 0)) return null
  const ex = price / 1.1, prof = ex - (cost || 0), pct = Math.round((prof / ex) * 100)
  return {
    text: 'Ex GST ' + cash2(ex) + (cost > 0 ? ' · cleaner ' + cash2(cost) + ' · profit ' + cash2(prof) + ' a clean (' + pct + '%)' : ''),
    cls: cost > 0 ? 'money h ' + (pct >= 30 ? 'good' : pct >= 20 ? 'watch' : 'low') : 'money', pct,
  }
}

export type View = 'recurring' | 'oneoff' | 'past'
export function inView(h: Home, v: View, today: string): boolean {
  const s = rState(h, today)
  if (v === 'recurring') return h.kind !== 'oneoff' && s !== 'ended'
  if (v === 'oneoff') return h.kind === 'oneoff' && (s === 'booked' || s === 'overdue')
  return s === 'ended' || s === 'done' || s === 'cancelled'
}

export interface HomeRow {
  id: string; name: string; suburb: string; sched: string; cleaner: string; meta: string; status: string; tag: string; tagCls: string
  price: string; margin: string; marginCls: string; search: string; views: View[]; sort: Record<View, string>
}
export function homeRow(h: Home, today: string, cleanerName: (id: string | null) => string): HomeRow {
  const s = rState(h, today), ml = moneyLine(h.price, h.cost), cl = cleanerName(h.cleaner_id)
  return {
    id: h.id, name: h.name, suburb: h.suburb || '', sched: schedText(h), cleaner: cl, meta: schedText(h) + ' · ' + cl, status: statusMeta(h, today),
    tag: STATE_TXT[s], tagCls: STATE_CLS[s],
    price: h.price > 0 ? cash(h.price) : 'No price', margin: !(h.price > 0) ? 'Add price' : ml && h.cost > 0 ? ml.pct + '%' : 'No cost',
    marginCls: !ml || !(h.cost > 0) ? 'h' : ml.pct >= 30 ? 'h good' : ml.pct >= 20 ? 'h watch' : 'h low',
    search: [h.name, h.suburb, h.street, h.phone, h.email, cl].join(' ').toLowerCase(),
    views: (['recurring', 'oneoff', 'past'] as View[]).filter(v => inView(h, v, today)),
    sort: {
      recurring: h.name.toLowerCase(),
      oneoff: (s === 'overdue' ? '0' : '1') + (h.first_clean || ''),
      past: 'z' + String(9999999999 - +((h.ended_on || h.first_clean || '').replace(/-/g, '') || 0)).padStart(10, '0'),
    },
  }
}

export { addr, freqLong, homeText, longDate, dLong, dShort, cash, cash2, t12 }

// ----- Timetable (mock-up rEventsOn) -----
export type CalShow = 'all' | 'recurring' | 'oneoff'
export interface HomeEvent { key: string; id: string; iso: string; client: string; suburb: string; start: string; finish: string; cleaner: string; unassigned: boolean; k: 'k1' | 'k6'; done: boolean; h: Home }
export function homeEventsOn(homes: Home[], iso: string, show: CalShow, cleanerName: (id: string | null) => string): HomeEvent[] {
  const out: HomeEvent[] = []
  for (const h of homes) {
    if (show !== 'all' && (show === 'oneoff') !== (h.kind === 'oneoff')) continue
    if (!homeOn(h, iso)) continue
    out.push({
      key: h.id + '|' + iso, id: h.id, iso, client: h.name, suburb: h.suburb || '', start: h.start_time || '', finish: h.finish_time || '',
      cleaner: cleanerName(h.cleaner_id), unassigned: !h.cleaner_id, k: h.kind === 'oneoff' ? 'k6' : 'k1', done: h.kind === 'oneoff' && !!h.done, h,
    })
  }
  return out.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.client.localeCompare(b.client)))
}

// ----- Team (mock-up rt*) -----
const live = (h: Home, today: string) => !rFinished(h, today)
export function homeLine(h: Home, today: string): string {
  const s = rState(h, today)
  return schedText(h) + (h.kind === 'oneoff' && h.start_time ? ' ' + t12(h.start_time) : '')
    + (s === 'paused' ? ' · paused' + (h.resume_on ? ' until ' + dShort(h.resume_on) : '') : s === 'starting' ? ' · starts ' + dShort(h.first_clean) : s === 'overdue' ? ' · not marked done' : '')
}
export interface TeamHome { id: string; name: string; line: string }
export interface TeamRow { id: string; name: string; sub: string; phone: string; homes: TeamHome[]; search: string }
const teamHomes = (list: Home[], today: string): TeamHome[] =>
  list.slice().sort((a, b) => a.name.localeCompare(b.name)).map(h => ({ id: h.id, name: h.name + (h.suburb ? ', ' + h.suburb : ''), line: homeLine(h, today) }))
export function teamData(homes: Home[], cleaners: { id: string; name: string; phone?: string | null }[], today: string): { unassigned: TeamHome[]; rows: TeamRow[] } {
  const mine = (id: string | null) => homes.filter(h => (h.cleaner_id || null) === id && live(h, today))
  const rows = cleaners.map(c => {
    const list = mine(c.id)
    let pm = 0
    for (const h of list) if (h.kind !== 'oneoff' && rState(h, today) !== 'paused') pm += perMonth(h)
    const n = Math.round(pm)
    return {
      id: c.id, name: c.name, phone: c.phone || '', homes: teamHomes(list, today),
      sub: [list.length + (list.length === 1 ? ' home' : ' homes'), n ? 'about ' + n + (n === 1 ? ' regular clean a month' : ' regular cleans a month') : '', c.phone || ''].filter(Boolean).join(' · '),
      search: [c.name, ...list.map(h => h.name + ' ' + (h.suburb || ''))].join(' ').toLowerCase(),
    }
  }).sort((a, b) => b.homes.length - a.homes.length || a.name.localeCompare(b.name))
  // A home whose cleaner is no longer on the team counts as having no cleaner.
  const ids = new Set(cleaners.map(c => c.id))
  return { unassigned: teamHomes(homes.filter(h => live(h, today) && (!h.cleaner_id || !ids.has(h.cleaner_id))), today), rows }
}
