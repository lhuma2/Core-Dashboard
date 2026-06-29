// Structured scope-of-works — single source of truth for a client's cleaning tasks.
// Same data renders the cleaner checklist now and (later) the branded schedule PDF.

export type ScopeFrequency = 'visit' | 'weekly' | 'fortnightly' | 'monthly' | 'quarterly'

export interface ScopeTask {
  id: string
  area: string                 // "Office" | "Wash" | "Kitchen" | "External" | "Floors" | …
  task: string                 // "Vacuum carpets and traffic lanes"
  frequency: ScopeFrequency
  day?: string                 // periodic tasks: which clean-day, e.g. "Mon"
}

export const FREQ_LABEL: Record<ScopeFrequency, string> = {
  visit: 'Every clean',
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
}

export const FREQ_ORDER: ScopeFrequency[] = ['visit', 'weekly', 'fortnightly', 'monthly', 'quarterly']

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const WEEKDAY_KEYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Brisbane "today" as YYYY-MM-DD and the 3-letter day key.
export function brisbaneToday(): string {
  return new Date()
    .toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', year: 'numeric', month: '2-digit', day: '2-digit' })
    .split('/').reverse().join('-')
}
export function brisbaneDayKey(): string {
  const wd = new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', weekday: 'short' })
  return wd.slice(0, 3) // "Mon", "Tue", …
}

// Pick the day tab to default to: today if it's a clean day, else the first clean day.
export function defaultDay(cleanDays: string[]): string {
  const today = brisbaneDayKey()
  if (cleanDays.includes(today)) return today
  return cleanDays[0] ?? today
}
