// Commercial client page: the shapes the page uses and the small pure helpers shared by the page and its actions.
// Words and checks follow the mock-up (Main.dc.html, client page).
import type { SowBox } from '@/lib/crew/jobs'
import { addonItems } from '@/lib/crew/jobs'
import { onCadence, isoAdd, isoDow, CAL_DOW } from './timetable'

export interface CpCleaner { id: string; name: string; region: string | null; leader: boolean; signed: boolean }
export interface CpAddon { id: string; name: string; freq: string; price: number; cost: number; next: string | null; items: string[] }
export interface CpService {
  id: string; siteId: string | null; siteName: string; siteStreet: string; siteSuburb: string; sitePostcode: string
  days: string[]; every: string; anchor: string | null; first: string | null; start: string; finish: string
  price: number; cost: number; access: string; cleaners: string[]; addons: CpAddon[]; sow: SowBox[]
}
export interface CpClient {
  id: string; name: string; contact: string; phone: string; email: string; street: string; suburb: string; postcode: string; state: string
  status: string; paused_from: string | null; resume_on: string | null; ended_on: string | null; reason: string; multi: boolean
  services: CpService[]
}
export interface CpProblem { id: string; body: string; when: string; cleaner: string; site: string; fixed: boolean }
export interface CpHistory { date: string; text: string }

export const PAUSE_REASONS = ['Client asked for a break', 'Site closed for holidays', 'Renovations or building works', 'Unpaid invoices', 'Other'] as const
export const END_REASONS = ['Went with another provider', 'Price', 'Not happy with the service', 'Business closed or moved', 'Contract ended', 'Other'] as const
export const ADDON_FREQ_LABEL: Record<string, string> = { once: 'One-off', weekly: 'Weekly', fortnightly: 'Fortnightly', monthly: 'Monthly', quarterly: 'Quarterly', six_monthly: 'Every 6 months', yearly: 'Yearly' }

export const tidy = (x: string | null | undefined) => String(x || '').trim().replace(/\s+/g, ' ')
/** The add-on's own task list, else Laith's standard list for that service. */
export const addonTasks = (a: { name: string; items?: string[] | null }) => (a.items && a.items.length ? a.items : addonItems(a.name))
/** Standard list for a kind on the Add a service form ('' for Custom or nothing chosen). */
export const presetFor = (kind: string) => (kind && kind !== 'Custom' ? addonItems(kind) : [])

/** "Client asked for a break (note)", or the note itself for Other. */
export function reasonText(reason: string, note: string): string {
  const n = tidy(note)
  return reason === 'Other' ? n : reason + (n ? ` (${n})` : '')
}

/** The next clean on or after today, used to fill "Next clean date" when the pattern needs one. */
export function nextVisit(s: { days: string[]; every: string; anchor: string | null; first: string | null }, today: string): string {
  for (let q = 0; q < 70; q++) {
    const d = isoAdd(today, q)
    if (s.days.includes(CAL_DOW[isoDow(d)]) && onCadence({ every: s.every, anchor: s.anchor, first: s.first }, d) && (!s.first || d >= s.first)) return d
  }
  return ''
}

/** "A, B and C" */
export const joinAnd = (a: string[]) => (a.length <= 1 ? a[0] || '' : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1])
