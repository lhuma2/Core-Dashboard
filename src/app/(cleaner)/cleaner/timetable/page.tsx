export const dynamic = 'force-dynamic'
export const revalidate = 0

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PortalShell } from '@/components/portal/PortalShell'
import { brisbaneTodayStr } from '@/lib/schedule'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function pad(n: number) {
  return n.toString().padStart(2, '0')
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Builds a Monday-first grid of dates covering the full month (plus lead/trail days). */
function buildMonthGrid(year: number, month: number) {
  const firstOfMonth = new Date(year, month, 1)
  // JS getDay(): 0 = Sunday ... 6 = Saturday. Convert to Monday-first offset.
  const leadOffset = (firstOfMonth.getDay() + 6) % 7
  const gridStart = new Date(year, month, 1 - leadOffset)

  const weeks: { dateStr: string; day: number; inMonth: boolean }[][] = []
  const cursor = new Date(gridStart)

  for (let w = 0; w < 6; w++) {
    const week: { dateStr: string; day: number; inMonth: boolean }[] = []
    for (let d = 0; d < 7; d++) {
      week.push({
        dateStr: toDateStr(cursor),
        day: cursor.getDate(),
        inMonth: cursor.getMonth() === month,
      })
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)
    // Stop once we've covered the month and filled a full trailing week.
    if (cursor.getMonth() !== month && weeks.length >= 4 && cursor.getDate() <= 7) break
  }

  return weeks
}

const STATUS_STYLES: Record<string, string> = {
  not_started: 'bg-brand-navy text-white',
  in_progress: 'bg-brand-navy-light text-white',
  completed:   'bg-brand-navy-muted text-white',
  flagged:     'bg-red-600 text-white',
  bond:        'bg-amber-500 text-white',
}

interface CalendarChip {
  id: string
  href: string
  label: string
  statusKey: string
}

export default async function CleanerTimetable({
  searchParams,
}: {
  searchParams: { month?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await (supabase as any)
    .from('profiles').select('*').eq('user_id', user.id).single()
  if (!profile) redirect('/login')

  const now = new Date()
  let year = now.getFullYear()
  let month = now.getMonth() // 0-indexed

  if (searchParams.month && /^\d{4}-\d{2}$/.test(searchParams.month)) {
    const [y, m] = searchParams.month.split('-').map(Number)
    year = y
    month = m - 1
  }

  const grid = buildMonthGrid(year, month)
  const gridStart = grid[0][0].dateStr
  const gridEnd = grid[grid.length - 1][6].dateStr

  const [{ data: jobs }, { data: bondJobs }] = await Promise.all([
    (supabase as any)
      .from('job_assignments')
      .select('id, scheduled_date, status, client_id, clients(business_name, suburb)')
      .eq('cleaner_id', profile.id)
      .gte('scheduled_date', gridStart)
      .lte('scheduled_date', gridEnd)
      .order('scheduled_date', { ascending: true }),
    (supabase as any)
      .from('bond_jobs')
      .select('id, clean_date, client_name')
      .eq('cleaner_id', profile.id)
      .gte('clean_date', gridStart)
      .lte('clean_date', gridEnd)
      .order('clean_date', { ascending: true }),
  ])

  const jobsByDate: Record<string, CalendarChip[]> = {}
  for (const job of jobs ?? []) {
    if (!jobsByDate[job.scheduled_date]) jobsByDate[job.scheduled_date] = []
    jobsByDate[job.scheduled_date].push({
      id: `job-${job.id}`,
      href: `/cleaner/jobs/${job.id}`,
      label: job.clients?.business_name ?? 'Job',
      statusKey: job.status,
    })
  }
  for (const bondJob of bondJobs ?? []) {
    if (!jobsByDate[bondJob.clean_date]) jobsByDate[bondJob.clean_date] = []
    jobsByDate[bondJob.clean_date].push({
      id: `bond-${bondJob.id}`,
      href: `/cleaner/bond/${bondJob.id}`,
      label: bondJob.client_name,
      statusKey: 'bond',
    })
  }

  const monthLabel = new Date(year, month, 1).toLocaleDateString('en-AU', {
    month: 'long',
    year: 'numeric',
  })

  const prevDate = new Date(year, month - 1, 1)
  const nextDate = new Date(year, month + 1, 1)
  const prevMonth = `${prevDate.getFullYear()}-${pad(prevDate.getMonth() + 1)}`
  const nextMonth = `${nextDate.getFullYear()}-${pad(nextDate.getMonth() + 1)}`

  // Use the business's local (Brisbane) date, not the server's — the server may
  // run in UTC, which drifts from "today" for hours around midnight AEST.
  const today = brisbaneTodayStr()

  return (
    <PortalShell userName={profile.full_name} subtitle="Cleaner Portal" backHref="/cleaner/dashboard" backLabel="Dashboard">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-black tracking-tight flex items-center gap-2">
          <Calendar className="w-5 h-5 text-brand-navy" />
          Timetable
        </h1>
      </div>

      <div className="flex items-center justify-between mb-4">
        <Link
          href={`/cleaner/timetable?month=${prevMonth}`}
          className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center active:bg-gray-50 transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-gray-500" />
        </Link>
        <p className="text-sm font-semibold text-black">{monthLabel}</p>
        <Link
          href={`/cleaner/timetable?month=${nextMonth}`}
          className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center active:bg-gray-50 transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-gray-500" />
        </Link>
      </div>

      <div className="bg-white rounded-2xl p-3 mb-6">
        <div className="grid grid-cols-7 mb-2">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="text-center text-[10px] font-semibold text-gray-400 uppercase">
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {grid.flat().map((cell) => {
            const cellJobs = jobsByDate[cell.dateStr] ?? []
            const isToday = cell.dateStr === today
            return (
              <div
                key={cell.dateStr}
                className={`min-h-[64px] rounded-lg p-1 flex flex-col items-center gap-1 ${
                  cell.inMonth ? '' : 'opacity-30'
                } ${isToday ? 'bg-brand-navy/5 ring-1 ring-brand-navy' : ''}`}
              >
                <span className={`text-[11px] font-medium ${isToday ? 'text-brand-navy font-bold' : 'text-gray-500'}`}>
                  {cell.day}
                </span>
                <div className="flex flex-col gap-0.5 w-full">
                  {cellJobs.slice(0, 2).map((chip) => {
                    // Today's not-yet-finished cleans get the orange "needs
                    // attention" treatment, overriding the normal per-status
                    // colour — but only for today, never other days.
                    const isOutstandingToday = isToday && chip.statusKey !== 'completed' && chip.statusKey !== 'bond'
                    return (
                      <Link
                        key={chip.id}
                        href={chip.href}
                        className={`block rounded px-1 py-0.5 text-[9px] font-medium leading-tight truncate ${
                          isOutstandingToday ? 'bg-brand-warning text-white' : (STATUS_STYLES[chip.statusKey] ?? STATUS_STYLES.not_started)
                        }`}
                        title={chip.label}
                      >
                        {chip.label}
                      </Link>
                    )
                  })}
                  {cellJobs.length > 2 && (
                    <span className="text-[9px] text-gray-400 text-center">+{cellJobs.length - 2} more</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap text-[11px] text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-brand-warning inline-block" /> Due today
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-brand-navy inline-block" /> Not started
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-brand-navy-light inline-block" /> In progress
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-brand-navy-muted inline-block" /> Completed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block" /> Flagged
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Bond clean
        </span>
      </div>
    </PortalShell>
  )
}
