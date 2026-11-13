// Commercial timetable, ported from the mock-up's calendar (Main.dc.html, "calendar" section).
// Pure functions on 'YYYY-MM-DD' strings (Brisbane dates), so the browser's own time zone never matters.

export const CAL_DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTHS3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const parts = (iso: string) => iso.split('-').map(Number) as [number, number, number]
const utc = (iso: string) => { const [y, m, d] = parts(iso); return Date.UTC(y, m - 1, d) }
export const isIso = (s?: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)
export function isoAdd(iso: string, n: number): string { const [y, m, d] = parts(iso); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10) }
export function isoDow(iso: string): number { return new Date(utc(iso)).getUTCDay() }
export function mondayOf(iso: string): string { const d = isoDow(iso); return isoAdd(iso, d === 0 ? -6 : 1 - d) }
export function monthStart(iso: string, n = 0): string { const [y, m] = parts(iso); return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10) }

/** "08:00" or "08:00:00" → "8am", "17:30" → "5:30pm". */
export function t12(t?: string | null): string {
  if (!t || !/^\d{2}:\d{2}/.test(t)) return ''
  let h = parseInt(t.slice(0, 2), 10)
  const m = t.slice(3, 5), ap = h >= 12 ? 'pm' : 'am'
  h = h % 12 || 12
  return h + (m === '00' ? '' : ':' + m) + ap
}
export function longDate(iso: string): string { const [, m, d] = parts(iso); return `${DAY_NAMES[isoDow(iso)]} ${d} ${MONTHS[m - 1]}` }
export function weekTitle(anchor: string): string {
  const ws = mondayOf(anchor), we = isoAdd(ws, 6)
  const [y1, m1, d1] = parts(ws), [y2, m2, d2] = parts(we)
  return m1 === m2 ? `${d1}–${d2} ${MONTHS[m1 - 1]} ${y1}` : `${d1} ${MONTHS3[m1 - 1]} – ${d2} ${MONTHS3[m2 - 1]} ${y2}`
}
export function monthTitle(anchor: string): string { const [y, m] = parts(anchor); return `${MONTHS[m - 1]} ${y}` }

/** Fortnightly counts whole weeks from the pattern date; monthly repeats on the same week of the month (5th week falls back to the last). */
export function onCadence(sc: { every?: string | null; anchor?: string | null; first?: string | null }, iso: string): boolean {
  const ev = sc.every || 'weekly'
  if (ev === 'weekly') return true
  const a = sc.anchor || sc.first
  if (!isIso(a)) return true
  const mon = (t: number) => t - ((new Date(t).getUTCDay() + 6) % 7) * 86400000
  if (ev === 'fortnightly') { const w = Math.round((mon(utc(iso)) - mon(utc(a))) / (7 * 86400000)); return ((w % 2) + 2) % 2 === 0 }
  const dom = +iso.slice(8, 10), aw = Math.ceil(+a.slice(8, 10) / 7)
  if (aw >= 5) { const dim = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7), 0)).getUTCDate(); return dom + 7 > dim }
  return Math.ceil(dom / 7) === aw
}

/** No cleans while paused (from the pause date until the restart date) or after the last clean of an ended client. */
export function offOn(c: { status?: string | null; paused_from?: string | null; resume_on?: string | null; ended_on?: string | null }, iso: string): boolean {
  if (c.status === 'ended') return !!c.ended_on && iso > c.ended_on
  if (c.status === 'paused') return !!c.paused_from && iso >= c.paused_from && (!c.resume_on || iso < c.resume_on)
  return false
}

export interface TtService {
  key: string            // service id
  clientId: string
  client: string
  colour: number         // 0-5, by client
  site: string           // '' for a single-site client
  days: string[]
  every: string
  anchor: string | null
  first: string | null
  start: string          // 'HH:MM' or ''
  finish: string
  cleaners: string       // "Prabin M., Angela J." or "Unassigned"
  status: string | null
  paused_from: string | null
  resume_on: string | null
  ended_on: string | null
  /** Extra cleans booked from client requests */
  extras?: { iso: string; start: string; finish: string; label?: string }[]
}

export interface TtEvent { key: string; iso: string; client: string; site: string; start: string; finish: string; cleaners: string; k: string }

export function eventsOn(services: TtService[], iso: string): TtEvent[] {
  const dw = CAL_DOW[isoDow(iso)]
  const out: TtEvent[] = []
  for (const sc of services) {
    const ex = sc.extras?.find(e => e.iso === iso)
    if (ex) {
      if (!offOn(sc, iso)) out.push({ key: `${sc.key}|${iso}`, iso, client: sc.client, site: [sc.site, ex.label || 'extra clean'].filter(Boolean).join(', '), start: ex.start, finish: ex.finish, cleaners: sc.cleaners, k: 'k' + (sc.colour % 6) })
      continue
    }
    if (!sc.days.includes(dw)) continue
    if (sc.first && iso < sc.first) continue
    if (offOn(sc, iso)) continue
    if (!onCadence(sc, iso)) continue
    out.push({ key: `${sc.key}|${iso}`, iso, client: sc.client, site: sc.site, start: sc.start, finish: sc.finish, cleaners: sc.cleaners, k: 'k' + (sc.colour % 6) })
  }
  return out.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.client.localeCompare(b.client)))
}

/** Every day shown in the month grid: Monday of the first week to Sunday of the last. */
export function monthGrid(anchor: string): string[] {
  const first = monthStart(anchor), last = isoAdd(monthStart(anchor, 1), -1)
  const start = mondayOf(first), end = isoAdd(mondayOf(last), 6)
  const n = Math.round((utc(end) - utc(start)) / 86400000) + 1
  return Array.from({ length: n }, (_, i) => isoAdd(start, i))
}
