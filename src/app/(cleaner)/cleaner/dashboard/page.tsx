export const dynamic = 'force-dynamic'
export const revalidate = 0

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PortalShell } from '@/components/portal/PortalShell'
import { AcceptClientButton } from '@/components/portal/cleaner/AcceptClientButton'
import { actionableDates, brisbaneTodayStr, getUpcomingDates } from '@/lib/schedule'
import { ChevronRight, ChevronLeft, Briefcase, Calendar, AlertCircle, XCircle } from 'lucide-react'

function pad(n: number) { return n.toString().padStart(2, '0') }
function toDateStr(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

/** Monday of the week containing dateStr (YYYY-MM-DD, no timezone conversion). */
function mondayOf(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const offset = (d.getDay() + 6) % 7 // Mon=0 ... Sun=6
  d.setDate(d.getDate() - offset)
  return toDateStr(d)
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}

interface WeekEntry {
  id: string
  href: string
  clientName: string
  address: string | null
  statusKey: string
  jobType: 'commercial' | 'bond'
  time: string | null   // HH:MM, 24-hour
}

const JOB_TYPE_LABELS: Record<WeekEntry['jobType'], string> = {
  commercial: 'Commercial',
  bond: 'Bond',
}

/** "14:05:00" or "9:30" -> "14:05" / "09:30" (24-hour, no seconds). */
function formatTime24(timeStr: string | null | undefined): string | null {
  if (!timeStr) return null
  const [h, m] = timeStr.split(':')
  if (h === undefined || m === undefined) return null
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`
}

const DAY_LABELS: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
}

const FREQ_LABELS: Record<string, string> = {
  weekly: 'Weekly', fortnightly: 'Fortnightly', monthly: 'Monthly',
  twice_weekly: 'Twice weekly', three_weekly: '3x per week',
  four_weekly: 'Every 4 weeks', adhoc: 'Ad hoc',
}

function dateLabel(dateStr: string, todayStr: string): string {
  if (dateStr === todayStr) return 'Today'
  if (dateStr === addDays(todayStr, 1)) return 'Tomorrow'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-AU', {
    weekday: 'short', day: 'numeric', month: 'short',
    timeZone: 'Australia/Brisbane',
  })
}

export default async function CleanerDashboard({
  searchParams,
}: {
  searchParams: { week?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await (supabase as any)
    .from('profiles').select('*').eq('user_id', user.id).single()
  if (!profile) redirect('/login')

  const today = brisbaneTodayStr()
  const dates = actionableDates(today)   // today + Saturday when it's Sunday

  const weekStart = searchParams.week && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.week)
    ? mondayOf(searchParams.week)
    : mondayOf(today)
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekEnd = weekDates[6]
  const prevWeek = addDays(weekStart, -7)
  const nextWeek = addDays(weekStart, 7)

  const pastFrom = new Date(Date.now() - 7 * 86_400_000).toISOString().split('T')[0]

  // Fetch clients + active jobs (weekend-aware) + past not-started jobs + this week's
  // real jobs (both regular and bond cleans) in parallel
  const [
    { data: clients }, { data: activeJobs }, { data: missedJobsRaw },
    { data: weekJobs }, { data: weekBondJobs },
  ] = await Promise.all([
    (supabase as any)
      .from('clients')
      .select('id, business_name, address, suburb, frequency, service_days, start_date, assignment_accepted')
      .eq('assigned_cleaner_id', profile.id)
      .eq('active', true)
      .order('business_name'),
    (supabase as any)
      .from('job_assignments')
      .select('id, status, client_id, clients(business_name, address, suburb)')
      .eq('cleaner_id', profile.id)
      .in('scheduled_date', dates)
      .in('status', ['in_progress', 'flagged']),
    (supabase as any)
      .from('job_assignments')
      .select('id, scheduled_date, status, client_id, clients(business_name, suburb)')
      .eq('cleaner_id', profile.id)
      .gte('scheduled_date', pastFrom)
      .lt('scheduled_date', today)
      .eq('status', 'not_started')
      .order('scheduled_date', { ascending: false }),
    (supabase as any)
      .from('job_assignments')
      .select('id, scheduled_date, status, address, client_id, site_id, clients(business_name, address, suburb)')
      .eq('cleaner_id', profile.id)
      .gte('scheduled_date', weekStart)
      .lte('scheduled_date', weekEnd),
    (supabase as any)
      .from('bond_jobs')
      .select('id, clean_date, clean_time, status, client_name, address')
      .eq('cleaner_id', profile.id)
      .gte('clean_date', weekStart)
      .lte('clean_date', weekEnd),
  ])

  const weekByDate: Record<string, WeekEntry[]> = {}
  for (const d of weekDates) weekByDate[d] = []

  // Real job rows already created (started, or manually assigned) take priority —
  // track which client/site + date pairs they cover so the schedule-derived
  // entries below don't duplicate them.
  const coveredScheduleKeys = new Set<string>()
  for (const job of weekJobs ?? []) {
    coveredScheduleKeys.add(`${job.client_id}::${job.site_id ?? ''}::${job.scheduled_date}`)
    const addr = job.address || [job.clients?.address, job.clients?.suburb].filter(Boolean).join(', ') || null
    weekByDate[job.scheduled_date]?.push({
      id: `job-${job.id}`,
      href: `/cleaner/jobs/${job.id}`,
      clientName: job.clients?.business_name ?? 'Job',
      address: addr,
      statusKey: job.status,
      jobType: 'commercial',
      time: null,
    })
  }
  for (const bond of weekBondJobs ?? []) {
    weekByDate[bond.clean_date]?.push({
      id: `bond-${bond.id}`,
      href: `/cleaner/bond/${bond.id}`,
      clientName: bond.client_name,
      address: bond.address,
      statusKey: bond.status === 'completed' ? 'completed' : 'bond',
      jobType: 'bond',
      time: formatTime24(bond.clean_time),
    })
  }

  const allClients: any[] = clients ?? []
  const pending  = allClients.filter((c) => !c.assignment_accepted)
  const accepted = allClients.filter((c) => c.assignment_accepted)
  const inProgressJob = (activeJobs ?? [])[0] ?? null

  // Sites this cleaner is assigned to individually (multi-site clients). The parent client may
  // not be assigned to them at the client level, so fetch via admin scoped to this cleaner.
  const adminDb = createAdminClient() as any
  const { data: mySitesRaw } = await adminDb
    .from('client_sites')
    .select('id, site_name, address, suburb, client_id, frequency, service_days, clients(business_name, active, start_date)')
    .eq('assigned_cleaner_id', profile.id)
  const assignedSites: any[] = (mySitesRaw ?? []).filter((s: any) => s.clients?.active !== false)

  // ── Fold this week's recurring schedule into the timetable ──
  // job_assignments rows only exist once a clean is started (or an admin manually
  // assigns one), so without this a newly added client — single-site or a commercial
  // (multi-site) one — would show nothing here until that happens. Compute the
  // schedule-implied cleans for the week directly from each client/site's own
  // frequency + service_days, same engine the client detail page already uses.
  const weekStartDate = new Date(weekStart + 'T00:00:00')
  type ScheduleSource = {
    clientId: string; siteId: string | null; label: string
    address: string | null; suburb: string | null
    frequency: string | null; serviceDays: string[]; startDate: string | null
  }
  const scheduleSources: ScheduleSource[] = [
    ...accepted.map((c: any): ScheduleSource => ({
      clientId: c.id, siteId: null, label: c.business_name,
      address: c.address ?? null, suburb: c.suburb ?? null,
      frequency: c.frequency ?? null, serviceDays: c.service_days ?? [], startDate: c.start_date ?? null,
    })),
    ...assignedSites.map((s: any): ScheduleSource => ({
      clientId: s.client_id, siteId: s.id,
      label: s.clients?.business_name ? `${s.clients.business_name} — ${s.site_name}` : s.site_name,
      address: s.address ?? null, suburb: s.suburb ?? null,
      frequency: s.frequency ?? null, serviceDays: s.service_days ?? [], startDate: s.clients?.start_date ?? null,
    })),
  ]
  for (const src of scheduleSources) {
    if (!src.serviceDays.length || !src.frequency || src.frequency === 'adhoc') continue
    const occurrences = getUpcomingDates({
      id: src.clientId, business_name: src.label, address: src.address, suburb: src.suburb,
      frequency: src.frequency, service_days: src.serviceDays, start_date: src.startDate,
    }, 6, weekStartDate)
    for (const d of occurrences) {
      const dateStr = toDateStr(d)
      if (dateStr < today) continue // don't fabricate history for days never actioned
      const key = `${src.clientId}::${src.siteId ?? ''}::${dateStr}`
      if (coveredScheduleKeys.has(key)) continue // a real job row already covers this day
      weekByDate[dateStr]?.push({
        id: `sched-${src.clientId}-${src.siteId ?? 'main'}-${dateStr}`,
        href: `/cleaner/clients/${src.clientId}${src.siteId ? `?site=${src.siteId}` : ''}`,
        clientName: src.label,
        address: [src.address, src.suburb].filter(Boolean).join(', ') || null,
        statusKey: 'not_started',
        jobType: 'commercial',
        time: null,
      })
    }
  }

  // Split past not-started jobs: a Saturday job carried into Sunday is still due
  // (actionable), everything older is a genuine missed clean.
  const pastNotStarted: any[] = missedJobsRaw ?? []
  const dueWeekend: any[] = pastNotStarted.filter((j) => dates.includes(j.scheduled_date))
  const missedJobs: any[]  = pastNotStarted.filter((j) => !dates.includes(j.scheduled_date))

  const weekLabel = weekStart === mondayOf(today)
    ? 'This Week'
    : `${new Date(weekStart + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} – ${new Date(weekEnd + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`

  const firstName = (profile.full_name ?? user.email ?? '').split(' ')[0]
  const hour = parseInt(
    new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', hour: 'numeric', hour12: false }), 10
  )
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <PortalShell userName={profile.full_name} subtitle="Cleaner Portal">

      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-black tracking-tight">
          {greeting}, {firstName}.
        </h1>
      </div>

      {/* ── 1. JOB IN PROGRESS (only when active) ── */}
      {inProgressJob && (
        <section className="mb-6">
          <Link href={`/cleaner/clients/${inProgressJob.client_id}`} className="block">
            <div className="bg-black text-white rounded-2xl px-5 py-4 flex items-center justify-between gap-3 active:opacity-80 transition-opacity">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-0.5">
                    {inProgressJob.status === 'flagged' ? 'Flagged — still open' : 'Clean in progress'}
                  </p>
                  <p className="text-base font-bold text-white truncate">
                    {inProgressJob.clients?.business_name ?? 'Current job'}
                  </p>
                  {inProgressJob.clients?.address && (
                    <p className="text-xs text-white/50 mt-0.5 truncate">{inProgressJob.clients.address}</p>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0 bg-white/10 rounded-xl px-3 py-2 text-xs font-semibold text-white">
                Finish →
              </div>
            </div>
          </Link>
        </section>
      )}

      {/* ── 1a. DUE THIS WEEKEND (Saturday jobs carried into Sunday) ── */}
      {dueWeekend.length > 0 && (
        <section className="mb-6">
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5" />
            Still due this weekend
          </p>
          <div className="space-y-2">
            {dueWeekend.map((job: any) => {
              const d = new Date(job.scheduled_date + 'T00:00:00')
              const dl = d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' })
              return (
                <Link key={job.id} href={`/cleaner/clients/${job.client_id}`} className="block">
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-center justify-between gap-3 active:bg-amber-100 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-black truncate">{job.clients?.business_name ?? '—'}</p>
                      <p className="text-xs text-amber-600 mt-0.5">{dl}'s clean · tap to start</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* ── 1b. MISSED CLEANS (tap to do them late) ── */}
      {missedJobs.length > 0 && (
        <section className="mb-6">
          <p className="text-xs font-semibold text-red-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <XCircle className="w-3.5 h-3.5" />
            Missed Clean{missedJobs.length > 1 ? 's' : ''}
          </p>
          <div className="space-y-2">
            {missedJobs.map((job: any) => {
              const d = new Date(job.scheduled_date + 'T00:00:00')
              const dateLabel = d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
              return (
                <Link key={job.id} href={`/cleaner/clients/${job.client_id}`} className="block">
                  <div className="bg-red-50 border border-red-100 rounded-2xl px-5 py-4 flex items-center justify-between gap-3 active:bg-red-100 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-black truncate">{job.clients?.business_name ?? '—'}</p>
                      <p className="text-xs text-red-400 mt-0.5">{dateLabel} · Not completed — tap to catch up</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-red-400 flex-shrink-0" />
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* ── 2. NEW ASSIGNMENTS (only when pending) ── */}
      {pending.length > 0 && (
        <section className="mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5" />
            New Assignment{pending.length > 1 ? 's' : ''}
          </p>
          <div className="space-y-3">
            {pending.map((client: any) => (
              <div key={client.id} className="bg-white rounded-2xl px-5 py-4">
                <p className="text-sm font-semibold text-black mb-1">{client.business_name}</p>
                {(client.address || client.suburb) && (
                  <p className="text-xs text-gray-500 mb-1">
                    {[client.address, client.suburb].filter(Boolean).join(', ')}
                  </p>
                )}
                {client.frequency && (
                  <p className="text-xs text-gray-400 mb-3">
                    {FREQ_LABELS[client.frequency] ?? client.frequency}
                    {(client.service_days ?? []).length > 0 && (
                      <> · {(client.service_days as string[]).map((d) => DAY_LABELS[d] ?? d).join(', ')}</>
                    )}
                  </p>
                )}
                <AcceptClientButton clientId={client.id} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 3. THIS WEEK'S TIMETABLE (the front-page timetable itself) ── */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <Link
            href={`/cleaner/dashboard?week=${prevWeek}`}
            className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center active:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </Link>
          <p className="text-sm font-semibold text-black flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-brand-navy" />
            {weekLabel}
          </p>
          <Link
            href={`/cleaner/dashboard?week=${nextWeek}`}
            className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center active:bg-gray-50 transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </Link>
        </div>

        <div className="space-y-3">
          {weekDates.map((d) => {
            const entries = weekByDate[d] ?? []
            const isToday = d === today
            return (
              <div
                key={d}
                className={`rounded-2xl border px-4 py-3.5 ${
                  isToday ? 'bg-brand-mint border-brand-mint-border' : 'bg-white border-gray-100'
                }`}
              >
                <div className="flex items-center gap-2 mb-2.5">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isToday ? 'bg-brand-navy' : 'bg-gray-300'}`} />
                  <p className={`text-xs font-semibold tracking-wide ${isToday ? 'text-brand-navy' : 'text-gray-400'}`}>
                    {dateLabel(d, today)}
                  </p>
                </div>
                {entries.length === 0 ? (
                  <p className="text-xs text-gray-300">No cleans scheduled</p>
                ) : (
                  <div className="space-y-2">
                    {entries.map((ev) => {
                      const outstandingToday = isToday && ev.statusKey !== 'completed'
                      return (
                        <Link key={ev.id} href={ev.href} className="block">
                          <div
                            className={`rounded-2xl px-5 py-5 flex items-center justify-between gap-3 active:opacity-80 transition-opacity ${
                              outstandingToday
                                ? 'bg-brand-warning/10 border-2 border-brand-warning'
                                : 'bg-white border border-gray-100'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                                  ev.jobType === 'bond' ? 'bg-amber-100 text-amber-700' : 'bg-brand-navy/10 text-brand-navy'
                                }`}>
                                  {JOB_TYPE_LABELS[ev.jobType]}
                                </span>
                                {ev.time && (
                                  <span className="text-xs font-semibold text-gray-500">{ev.time}</span>
                                )}
                              </div>
                              <p className="text-base font-bold text-black truncate">{ev.clientName}</p>
                              {ev.address && (
                                <p className="text-sm text-gray-500 mt-1 truncate">{ev.address}</p>
                              )}
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* ── MY SITES (individually-assigned sites of multi-site clients) ── */}
      {assignedSites.length > 0 && (
        <section className="mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">My Sites</p>
          <div className="space-y-2">
            {assignedSites.map((site: any) => (
              <Link key={site.id} href={`/cleaner/clients/${site.client_id}?site=${site.id}`} className="block">
                <div className="bg-white rounded-2xl px-5 py-4 flex items-center justify-between gap-3 active:bg-gray-50 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-black truncate">{site.site_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {site.clients?.business_name}{site.suburb ? ` · ${site.suburb}` : ''}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── MY CLIENTS ── */}
      {accepted.length > 0 && (
        <section className="mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">My Clients</p>
          <div className="space-y-2">
            {accepted.map((client: any) => (
              <Link key={client.id} href={`/cleaner/clients/${client.id}`} className="block">
                <div className="bg-white rounded-2xl px-5 py-4 flex items-center justify-between gap-3 active:bg-gray-50 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-black truncate">{client.business_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {FREQ_LABELS[client.frequency] ?? client.frequency ?? '—'}
                      {(client.service_days ?? []).length > 0 && (
                        <> · {(client.service_days as string[]).map((d: string) => DAY_LABELS[d] ?? d).join(', ')}</>
                      )}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── EMPTY STATE ── */}
      {allClients.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <Briefcase className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-700">No clients assigned yet</p>
          <p className="text-xs text-gray-400 mt-1">Your manager will assign clients to you.</p>
        </div>
      )}


    </PortalShell>
  )
}
