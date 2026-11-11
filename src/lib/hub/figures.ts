// Dashboard figures for the new hub. Pure functions, no database access, so they can be tested
// against the mock-up's own maths (hub-rebuild/go-live-wiring.md, v57 and v58).
// Dates are 'YYYY-MM-DD' strings in Brisbane time.

export type Every = 'weekly' | 'fortnightly' | 'monthly'
export type AddonFreq = 'once' | 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'six_monthly' | 'yearly'
export type Status = 'active' | 'paused' | 'ended'

export const CLEANS_PER_MONTH: Record<Every, number> = { weekly: 52 / 12, fortnightly: 26 / 12, monthly: 1 }
export const ADDON_PER_YEAR: Record<AddonFreq, number> = {
  once: 0, weekly: 52, fortnightly: 26, monthly: 12, quarterly: 4, six_monthly: 2, yearly: 1,
}

/** Today's date in Brisbane, as YYYY-MM-DD. */
export function brisbaneToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Brisbane' }).format(now)
}

/** Hour of the day in Brisbane (0-23), for the greeting. */
export function brisbaneHour(now: Date = new Date()): number {
  const h = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Brisbane', hour: 'numeric', hourCycle: 'h23' }).format(now)
  return Number(h) % 24
}

export function greeting(hour: number): string {
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
}

/** Cleans a month for a service: number of cleaning days × how often. Unknown frequency counts as weekly. */
export function cleansPerMonth(s: { days?: string[] | null; every?: string | null }): number {
  const per = CLEANS_PER_MONTH[(s.every as Every)] ?? CLEANS_PER_MONTH.weekly
  return (s.days?.length ?? 0) * per
}

/** A paused client whose restart date has arrived counts as active again. */
export function currentStatus(c: { status?: string | null; resume_on?: string | null }, today: string): Status {
  if (!c.status || c.status === 'active') return 'active'
  if (c.status === 'paused' && c.resume_on && c.resume_on <= today) return 'active'
  return c.status as Status
}

export interface Totals {
  revenue: number      // whole dollars, ex GST, a month
  profit: number
  margin: number | null // percent, null while revenue is $0
  clients: number
  noPrice: number
}

function finish(rev: number, cost: number, clients: number, noPrice: number): Totals {
  return {
    revenue: Math.round(rev),
    profit: Math.round(rev - cost),
    margin: rev > 0 ? Math.round(((rev - cost) / rev) * 100) : null,
    clients,
    noPrice,
  }
}

export interface CommercialClient {
  status?: string | null
  resume_on?: string | null
  services: {
    days: string[]
    every: string
    price: number
    cost: number
    addons: { freq: string; price: number; cost: number }[]
  }[]
}

/** Commercial card: active clients only. Prices are already ex GST. Add-ons count by how many times a year. */
export function commercialTotals(list: CommercialClient[], today: string): Totals {
  let rev = 0, cost = 0, n = 0, noPrice = 0
  for (const c of list) {
    if (currentStatus(c, today) !== 'active') continue
    n++
    let clientRev = 0 // summed per client first, the same order as the mock-up, so rounding matches to the dollar
    for (const sv of c.services) {
      const cpm = cleansPerMonth(sv)
      clientRev += (Number(sv.price) || 0) * cpm
      cost += (Number(sv.cost) || 0) * cpm
      for (const a of sv.addons) {
        const py = ADDON_PER_YEAR[a.freq as AddonFreq] ?? 0
        clientRev += ((Number(a.price) || 0) * py) / 12
        cost += ((Number(a.cost) || 0) * py) / 12
      }
    }
    if (!c.services.some(sv => Number(sv.price) > 0)) noPrice++
    rev += clientRev
  }
  return finish(rev, cost, n, noPrice)
}

export interface Home {
  kind: string
  every?: string | null
  days: string[]
  first_clean?: string | null
  price: number   // incl GST
  cost: number
  status?: string | null
  resume_on?: string | null
  cancelled?: boolean | null
}

/**
 * Residential / End of Lease card, ex GST: active recurring homes × cleans a month, plus this month's
 * one-offs that aren't cancelled. A home with no price counts as a client but is left out of revenue and cost.
 */
export function homeTotals(homes: Home[], today: string): Totals {
  let rev = 0, cost = 0, n = 0, noPrice = 0
  const month = today.slice(0, 7)
  for (const h of homes) {
    const priced = (Number(h.price) || 0) > 0
    if (h.kind === 'oneoff') {
      if (h.cancelled || (h.first_clean || '').slice(0, 7) !== month) continue
      n++
      if (!priced) { noPrice++; continue }
      rev += Number(h.price) / 1.1
      cost += Number(h.cost) || 0
      continue
    }
    if (currentStatus(h, today) !== 'active') continue
    n++
    if (!priced) { noPrice++; continue }
    const cpm = cleansPerMonth(h)
    rev += (Number(h.price) / 1.1) * cpm
    cost += (Number(h.cost) || 0) * cpm
  }
  return finish(rev, cost, n, noPrice)
}

/** "$12,345" or "-$1,200". */
export function money(n: number): string {
  return (n < 0 ? '-$' : '$') + Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** The note under the greeting about clients without prices. */
export function noPriceNote(commercial: number, residential: number): string {
  const parts: string[] = []
  if (commercial) parts.push((commercial === 1 ? '1 commercial client has' : `${commercial} commercial clients have`) + ' no prices yet, so they add $0.')
  if (residential) parts.push((residential === 1 ? '1 residential client has' : `${residential} residential clients have`) + ' no price yet, so they’re left out of revenue and profit.')
  return parts.join(' ')
}

// ── Client surveys (commercial, every 2 months, Laith approves every send) ──

/** Add n months, keeping the day but clamping to the month's last day (31 Jan + 1 = 28/29 Feb). */
export function addMonths(iso: string, n: number): string {
  const [y, mo, d] = iso.split('-').map(Number)
  const m = mo - 1 + n
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  return new Date(Date.UTC(y, m, Math.min(d, last))).toISOString().slice(0, 10)
}

export interface SurveyClient {
  id: string
  status?: string | null
  resume_on?: string | null
  surveys_off?: boolean | null
  survey_snooze_until?: string | null
  first_clean?: string | null   // earliest first clean across the client's sites
}
export interface Survey {
  client_id: string
  sent_at: string
  answered_at?: string | null
  followed_at?: string | null
  scores?: number[] | null // the five answers, when answered
}

/** When the client's next survey comes up to send ('' = nothing due yet). */
export function surveyBase(c: SurveyClient, surveys: Survey[], today: string): string {
  const mine = surveys.filter(s => s.client_id === c.id).sort((a, b) => b.sent_at.localeCompare(a.sent_at))
  const last = mine[0]
  const first = c.first_clean || ''
  if (!last && !/^\d{4}-\d{2}-\d{2}$/.test(first)) return ''
  let base = last ? addMonths(last.sent_at, 2) : addMonths(first, 2)
  if (currentStatus(c, today) === 'paused' && c.resume_on && base < c.resume_on) base = c.resume_on
  const snooze = c.survey_snooze_until
  if (snooze && base < snooze && (!last || last.sent_at < snooze)) base = snooze
  return base
}

export function surveyCard(clients: SurveyClient[], surveys: Survey[], today: string) {
  const waiting = surveys.filter(s => !s.answered_at)
  const answered = surveys.filter(s => !!s.answered_at)
  const low = (s: Survey) => (s.scores ?? []).some(v => v <= 6)
  const toFollow = answered.filter(s => !s.followed_at && low(s)).length
  const due = clients.filter(c => {
    const b = surveyBase(c, surveys, today)
    return !!b && !c.surveys_off && currentStatus(c, today) === 'active' && !waiting.some(s => s.client_id === c.id) && b <= today
  }).length
  const yearAgo = addMonths(today, -12)
  const year = answered.filter(s => (s.answered_at as string) >= yearAgo)
  const avgOf = (s: Survey) => {
    const sc = s.scores ?? []
    return Math.round((sc.reduce((t, v) => t + v, 0) / 5) * 10) / 10
  }
  const overall = year.length ? year.reduce((t, s) => t + avgOf(s), 0) / year.length : 0
  const avg = year.length ? (Math.round(overall * 10) / 10).toFixed(1).replace(/\.0$/, '') + ' / 10' : '—'
  return { due, toFollow, waiting: waiting.length, avg }
}

// ── Team ──
export const REGIONS = [
  { id: 'north', name: 'North Brisbane' },
  { id: 'south', name: 'South Brisbane' },
  { id: 'ipswich', name: 'Ipswich' },
  { id: 'gold_coast', name: 'Gold Coast' },
] as const

export function teamCard(cleaners: { region?: string | null }[]) {
  const regions = REGIONS.map(r => ({ name: r.name, count: cleaners.filter(c => c.region === r.id).length }))
  const known = new Set<string>(REGIONS.map(r => r.id))
  const toSort = cleaners.filter(c => !c.region || !known.has(c.region)).length
  const total = cleaners.length
  const sub = toSort ? `${total} registered cleaners · ${toSort} to sort into a region` : `${total} registered cleaners`
  return { regions, total, toSort, sub }
}
