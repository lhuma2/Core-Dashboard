/**
 * Scheduling utilities — calculates upcoming service dates from client data.
 * Used by the cleaner dashboard and the ICS calendar feed.
 */

const DAY_NUM: Record<string, number> = {
  // Full names
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
  // Short abbreviations (used by the day-picker in ClientForm)
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
}

/** Today's date in Brisbane (YYYY-MM-DD), independent of server timezone. */
export function brisbaneTodayStr(): string {
  return new Date()
    .toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', year: 'numeric', month: '2-digit', day: '2-digit' })
    .split('/').reverse().join('-')
}

/**
 * The set of scheduled dates a cleaner can still action "today".
 * Normally just today — but a Saturday clean stays actionable through the
 * Sunday of the same weekend, since weekend jobs often slip a day.
 */
export function actionableDates(todayStr?: string): string[] {
  const today = todayStr ?? brisbaneTodayStr()
  const dates = [today]
  const d = new Date(today + 'T00:00:00')
  if (d.getDay() === 0) {
    // Sunday — Saturday's jobs are still in play
    const sat = new Date(d.getTime() - 86_400_000)
    dates.push(sat.toISOString().split('T')[0])
  }
  return dates
}

export interface ClientSchedule {
  id:           string
  business_name: string
  address:      string | null
  suburb:       string | null
  frequency:    string | null
  service_days: string[]
  start_date:   string | null
}

/**
 * Returns upcoming dates (midnight AEST) for a client within `daysAhead` days,
 * starting from `fromDate` (defaults to today AEST).
 */
export function getUpcomingDates(client: ClientSchedule, daysAhead = 60, fromDate?: Date): Date[] {
  const days    = (client.service_days ?? []).map((d) => DAY_NUM[d.toLowerCase()]).filter((n) => n !== undefined)
  const freq    = client.frequency ?? ''
  if (days.length === 0 || !freq || freq === 'adhoc') return []

  // Anchor for fortnightly / 4-weekly cadence
  const anchor = client.start_date ? new Date(client.start_date + 'T00:00:00') : new Date()
  anchor.setHours(0, 0, 0, 0)

  const today = fromDate ? new Date(fromDate) : new Date()
  today.setHours(0, 0, 0, 0)

  const end = new Date(today)
  end.setDate(end.getDate() + daysAhead)

  const results: Date[] = []
  const cursor = new Date(today)

  while (cursor <= end) {
    const dow = cursor.getDay()
    if (days.includes(dow)) {
      const weeksSinceAnchor = Math.round(
        (cursor.getTime() - anchor.getTime()) / (7 * 24 * 60 * 60 * 1000)
      )
      let include = false

      switch (freq) {
        case 'daily':
        case 'weekly':
        case 'twice_weekly':
        case 'three_weekly':
          include = true
          break
        case 'fortnightly':
          include = weeksSinceAnchor % 2 === 0
          break
        case 'four_weekly':
          include = weeksSinceAnchor % 4 === 0
          break
        case 'monthly': {
          // First occurrence of this weekday in the calendar month
          const dom = cursor.getDate()
          include = dom <= 7
          break
        }
        case 'quarterly': {
          // First occurrence of this weekday in Jan, Apr, Jul, Oct
          const month = cursor.getMonth() // 0-indexed
          const dom = cursor.getDate()
          include = [0, 3, 6, 9].includes(month) && dom <= 7
          break
        }
        case 'annual': {
          // First occurrence of this weekday in January
          include = cursor.getMonth() === 0 && cursor.getDate() <= 7
          break
        }
        default:
          include = false
      }

      if (include) results.push(new Date(cursor))
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  return results
}

/**
 * Returns upcoming events (date + client) for a set of clients,
 * sorted by date, limited to `daysAhead` days.
 */
export interface ScheduleEvent {
  date:    Date
  dateStr: string   // YYYY-MM-DD
  client:  ClientSchedule
}

export function buildSchedule(clients: ClientSchedule[], daysAhead = 14): ScheduleEvent[] {
  const events: ScheduleEvent[] = []

  for (const client of clients) {
    for (const date of getUpcomingDates(client, daysAhead)) {
      events.push({
        date,
        dateStr: date.toISOString().split('T')[0],
        client,
      })
    }
  }

  events.sort((a, b) => a.date.getTime() - b.date.getTime())
  return events
}
