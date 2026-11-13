// The cleaner app's jobs, worked out from the homes and commercial services a cleaner is on (mock-up Cleaner.dc.html).
// Pure functions: used by the server loader and the screens. A `jobs` row only exists once Start clean is tapped.
import { CAL_DOW, isoAdd, isoDow, MONTHS, offOn, onCadence } from '@/lib/hub/timetable'

export type CrewKind = 'res' | 'eol' | 'com'
export const MINPH = 3, MINPH_EOL = 20, MAXPH = 40
/** Photos are deleted this many days after the clean: End of Lease 21 (bond evidence), everything else 7. */
export const keepDays = (kind: CrewKind | 'commercial' | 'residential') => (kind === 'eol' ? 21 : 7)

export interface Tsk { text: string; freq: string }
export interface SowBox { heading: string; items: Tsk[] }
export interface CrewAddon { id: string; name: string; freq: string; items: string[]; carried: boolean; from: string | null }
export interface CrewJob {
  key: string; kind: CrewKind; refId: string; clientId: string | null; iso: string
  name: string; address: string; suburb: string; start: string; finish: string
  team: string[]; homeLabel: string; access: string; sow: SowBox[]; excludes: string; addons: CrewAddon[]
  jobId: string | null; status: 'booked' | 'in_progress' | 'done'; startedAt: string | null; finishedAt: string | null
  ticks: Record<string, boolean>; photoCount: number; note: string; minPh: number
}

// ── keys: h.<home id>.<date> or s.<service id>.<date> ─────────
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const jobKey = (t: 'h' | 's', id: string, iso: string) => `${t}.${id}.${iso}`
export function parseKey(k: string): { t: 'h' | 's'; id: string; iso: string } | null {
  const m = /^([hs])\.([0-9a-f-]{36})\.(\d{4}-\d{2}-\d{2})$/i.exec(k || '')
  if (!m || !UUID.test(m[2])) return null
  return { t: m[1] as 'h' | 's', id: m[2].toLowerCase(), iso: m[3] }
}

// ── formatting (mock-up helpers) ──────────────────────────────
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export function dateLabel(iso: string): string { return DAYS[isoDow(iso)] + ' ' + +iso.slice(8, 10) + ' ' + MONTHS[+iso.slice(5, 7) - 1] }
/** 09:00 → 9:00 am (the cleaner app's style) */
export function t12(t?: string | null): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(t || '')
  if (!m) return ''
  const h = +m[1]
  return (h % 12 || 12) + ':' + m[2] + ' ' + (h >= 12 ? 'pm' : 'am')
}
export const firstName = (n?: string | null) => String(n || '').trim().split(/\s+/)[0] || ''
const plural = (n: number, one: string, many: string) => n + ' ' + (n === 1 ? one : many)
export const cap = (s: string) => s.replace(/^./, c => c.toUpperCase())

// ── add-ons on commercial services (v63) ──────────────────────
export const ADDON_FREQ: Record<string, string> = { once: 'one-off', weekly: 'weekly', fortnightly: 'fortnightly', monthly: 'monthly', quarterly: 'quarterly', six_monthly: 'every 6 months', yearly: 'yearly' }
/** Laith's standard task lists for each add-on (mock-up specMethods). */
export const ADDON_ITEMS: Record<string, string[]> = {
  'carpet steam clean': ['Pre-vacuum of all carpeted areas', 'Pre-spray of traffic lanes and marks', 'Hot water extraction', 'Spot treatment of stains where possible', 'Carpet left to dry with airflow'],
  'vinyl strip and seal': ['Furniture moved within the area where practical', 'Old sealant stripped back', 'Floor scrubbed and rinsed', 'Fresh coats of sealer applied', 'Furniture returned once dry'],
  'internal windows': ['Internal glass cleaned streak-free', 'Internal window frames wiped down', 'Window seals wiped and detailed', 'Window tracks vacuumed and wiped', 'Window sills wiped down'],
  'internal & external windows': ['Glass cleaned streak-free, inside and out', 'Window frames wiped down, inside and out', 'Window seals wiped and detailed, inside and out', 'Window tracks vacuumed and wiped, inside and out', 'Window sills wiped down, inside and out'],
  'window cleaning': ['Glass cleaned streak-free, inside and out', 'Window frames wiped down, inside and out', 'Window seals wiped and detailed, inside and out', 'Window tracks vacuumed and wiped, inside and out', 'Window sills wiped down, inside and out'],
  'pressure washing': ['Loose debris swept from the area', 'High-pressure clean of the surface', 'Edges and corners detailed', 'Area rinsed and left clean'],
}
export const addonItems = (name: string) => ADDON_ITEMS[String(name || '').trim().toLowerCase()] || []

function addMon(iso: string, n: number): string {
  const y = +iso.slice(0, 4), m = +iso.slice(5, 7) - 1 + n, d = +iso.slice(8, 10)
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  return new Date(Date.UTC(y, m, Math.min(d, last))).toISOString().slice(0, 10)
}
/** Next due after a clean on `iso` where the add-on was done. One-off: null (finished). */
export function advance(iso: string, f: string): string | null {
  return f === 'weekly' ? isoAdd(iso, 7) : f === 'fortnightly' ? isoAdd(iso, 14) : f === 'monthly' ? addMon(iso, 1) : f === 'quarterly' ? addMon(iso, 3) : f === 'six_monthly' ? addMon(iso, 6) : f === 'yearly' ? addMon(iso, 12) : null
}

// ── schedules ─────────────────────────────────────────────────
export interface HomeSrc {
  id: string; division: 'res' | 'eol'; name: string; street: string | null; suburb: string | null; state: string | null; postcode: string | null
  kind: 'recurring' | 'oneoff'; every: string | null; days: string[]; anchor: string | null; first_clean: string | null
  start_time: string | null; finish_time: string | null; beds: number; baths: number; notes: string | null
  status: string | null; paused_from: string | null; resume_on: string | null; ended_on: string | null; done: boolean; cancelled: boolean
  windows_freq: string | null; scope: { heading: string; items: string[] }[] | null
}
export interface AddonSrc { id: string; name: string; freq: string; next_date: string | null; items?: string[] | null }
export interface SvcSrc {
  id: string; clientId: string; name: string; address: string; suburb: string; days: string[]; every: string; anchor: string | null; first: string | null
  start: string; finish: string; access: string; team: string[]; scope: SowBox[]
  status: string | null; paused_from: string | null; resume_on: string | null; ended_on: string | null; addons: AddonSrc[]
}
export interface JobRow { id: string; home_id: string | null; service_id: string | null; clean_date: string; status: string; started_at: string | null; finished_at: string | null; ticks: Record<string, boolean> | null; photo_count: number; note: string | null }

export function homeOnDay(h: HomeSrc, iso: string): boolean {
  if (h.kind === 'oneoff') return !h.cancelled && h.first_clean === iso
  if (!(h.days || []).includes(CAL_DOW[isoDow(iso)])) return false
  if (h.first_clean && iso < h.first_clean) return false
  if (offOn(h, iso)) return false
  return onCadence({ every: h.every, anchor: h.anchor, first: h.first_clean }, iso)
}
export function svcOnDay(s: SvcSrc, iso: string): boolean {
  if (!s.days.includes(CAL_DOW[isoDow(iso)])) return false
  if (s.first && iso < s.first) return false
  if (offOn(s, iso)) return false
  return onCadence({ every: s.every, anchor: s.anchor, first: s.first }, iso)
}
function visitOnOrAfter(s: SvcSrc, iso: string): string | null {
  for (let n = 0; n < 400; n++) { const d = isoAdd(iso, n); if (svcOnDay(s, d)) return d }
  return null
}

/** The add-ons due on this clean: the first clean on or after the next due date. One that was due on an earlier clean
 *  that finished without it is carried over. If today's clean is finished without it, it moves to the next clean. */
export function addonsOn(s: SvcSrc, iso: string, today: string, todayRun: JobRow | undefined): CrewAddon[] {
  const out: CrewAddon[] = []
  for (const a of s.addons) {
    if (!a.next_date) continue // no due date yet, so cleaners don't see it
    let d = visitOnOrAfter(s, a.next_date > today ? a.next_date : today)
    if (d && d === today && todayRun && todayRun.status === 'done' && !(todayRun.ticks || {})['x:' + a.id]) d = visitOnOrAfter(s, isoAdd(today, 1))
    if (d !== iso) continue
    const firstDue = visitOnOrAfter(s, a.next_date)
    out.push({ id: a.id, name: a.name, freq: a.freq, items: a.items && a.items.length ? a.items : addonItems(a.name), carried: !!firstDue && firstDue < iso, from: firstDue })
  }
  return out
}

const RES_EXCL = 'carpet steam cleaning, pest control, rubbish removal, and any item outside the scope listed above. Table tops with excessive belongings are left untouched to avoid loss of items.'
const EOL_EXCL = 'Extra-heavy mould, heavy grease or baked-on build-up, heavily soiled areas and anything outside this scope may cost extra. Call Laith before doing extra work.'
const WINF: Record<string, string> = { each: 'Every visit', monthly: 'Once a month', quarterly: 'Every 3 months', once: 'First clean only' }

function homeSow(h: HomeSrc, fallback: SowBox[]): SowBox[] {
  const one = h.kind === 'oneoff' || h.division === 'eol'
  const base = one ? 'One-off' : 'Every visit'
  if (!h.scope || !h.scope.length) return fallback.map(b => ({ heading: b.heading, items: b.items.map(i => ({ text: i.text, freq: base })) }))
  return h.scope.filter(b => b.items.length).map(b => {
    const win = !one && /window/i.test(b.heading) && /add-on/i.test(b.heading)
    const freq = win ? WINF[h.windows_freq || 'monthly'] || base : base
    return { heading: b.heading || 'Scope of works', items: b.items.map(text => ({ text, freq })) }
  })
}

const ST = (r?: JobRow) => (r ? (r.status === 'done' ? 'done' : r.status === 'in_progress' ? 'in_progress' : 'booked') : 'booked') as CrewJob['status']
function runFields(r: JobRow | undefined) {
  return { jobId: r?.id ?? null, status: ST(r), startedAt: r?.started_at ?? null, finishedAt: r?.finished_at ?? null, ticks: (r?.ticks as Record<string, boolean>) || {}, photoCount: r?.photo_count ?? 0, note: r?.note ?? '' }
}

export function homeJob(h: HomeSrc, iso: string, me: string, run: JobRow | undefined, fallback: SowBox[]): CrewJob {
  const eol = h.division === 'eol'
  const rooms = plural(h.beds || 0, 'bedroom', 'bedrooms') + ', ' + plural(h.baths || 0, 'bathroom', 'bathrooms')
  return {
    key: jobKey('h', h.id, iso), kind: eol ? 'eol' : 'res', refId: h.id, clientId: null, iso,
    name: h.name, address: [h.street, [h.suburb, h.state || 'QLD', h.postcode].filter(Boolean).join(' ')].filter(Boolean).join(', '), suburb: h.suburb || '',
    start: (h.start_time || '').slice(0, 5), finish: (h.finish_time || '').slice(0, 5), team: [me],
    homeLabel: (eol ? 'End of lease: ' : 'Home: ') + rooms + (!eol && h.kind === 'oneoff' ? ' · deep clean' : ''),
    access: (h.notes || '').trim(), sow: homeSow(h, fallback), excludes: eol ? EOL_EXCL : RES_EXCL, addons: [],
    ...runFields(run), minPh: eol ? MINPH_EOL : MINPH,
  }
}
export function svcJob(s: SvcSrc, iso: string, today: string, run: JobRow | undefined, todayRun: JobRow | undefined): CrewJob {
  return {
    key: jobKey('s', s.id, iso), kind: 'com', refId: s.id, clientId: s.clientId, iso,
    name: s.name, address: s.address, suburb: s.suburb, start: s.start, finish: s.finish, team: s.team, homeLabel: '',
    access: s.access.trim(), sow: s.scope, excludes: '', addons: addonsOn(s, iso, today, todayRun),
    ...runFields(run), minPh: MINPH,
  }
}

/** Every job of the cleaner from `from` for `days` days, sorted by date then start time. */
export function crewJobs(homes: HomeSrc[], svcs: SvcSrc[], runs: JobRow[], me: string, today: string, from: string, days: number, fallback: (h: HomeSrc) => SowBox[]): CrewJob[] {
  const runOf = (t: 'h' | 's', id: string, iso: string) => runs.find(r => (t === 'h' ? r.home_id : r.service_id) === id && r.clean_date === iso)
  const out: CrewJob[] = []
  for (let i = 0; i < days; i++) {
    const iso = isoAdd(from, i)
    for (const h of homes) if (homeOnDay(h, iso)) out.push(homeJob(h, iso, me, runOf('h', h.id, iso), fallback(h)))
    for (const s of svcs) if (svcOnDay(s, iso)) out.push(svcJob(s, iso, today, runOf('s', s.id, iso), runOf('s', s.id, today)))
  }
  return out.sort((a, b) => (a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : (a.start || '99') < (b.start || '99') ? -1 : (a.start || '99') > (b.start || '99') ? 1 : a.name.localeCompare(b.name)))
}

/** Total checklist items and how many are ticked (scope only; add-ons have their own Mark done). */
export function tickCount(j: CrewJob): { done: number; total: number } {
  let done = 0, total = 0
  j.sow.forEach((b, bi) => b.items.forEach((_, ii) => { total++; if (j.ticks[bi + '.' + ii]) done++ }))
  return { done, total }
}

/** Commercial scope stored on the client or site: [{ area, task, frequency }] → boxes by area. */
export function scopeBoxes(raw: unknown, text?: string | null): SowBox[] {
  const FL: Record<string, string> = { visit: 'Every visit', weekly: 'Weekly', fortnightly: 'Fortnightly', monthly: 'Monthly', quarterly: 'Quarterly' }
  const list = Array.isArray(raw) ? raw : []
  const boxes: SowBox[] = []
  for (const t of list) {
    const task = String((t as any)?.task || '').trim()
    if (!task) continue
    const area = String((t as any)?.area || '').trim() || 'Throughout'
    let b = boxes.find(x => x.heading === area)
    if (!b) { b = { heading: area, items: [] }; boxes.push(b) }
    b.items.push({ text: task, freq: FL[(t as any)?.frequency] || 'Every visit' })
  }
  if (boxes.length) return boxes
  const lines = String(text || '').split(/\r?\n/).map(l => l.replace(/^[-•*\s]+/, '').trim()).filter(Boolean)
  return lines.length ? [{ heading: 'Scope of works', items: lines.map(text => ({ text, freq: 'Every visit' })) }] : []
}
