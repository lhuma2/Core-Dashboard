import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'
import { sendPushToRole } from '@/lib/push'
import { getUpcomingDates } from '@/lib/schedule'

// Vercel cron: runs every Monday at 8 AM Brisbane time (Monday 22:00 UTC Sun)
// Sends a weekly summary of all jobs in the past 7 days that were not completed.
// Covers two cases:
//   1. job_assignment exists but was never marked complete (not_started / in_progress)
//   2. A job was scheduled per the client's recurring schedule but no record was ever created

const REPORT_EMAIL = 'hello@deltacleaning.com.au'

function brisbaneDate(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000)
  return d.toLocaleString('en-AU', {
    timeZone: 'Australia/Brisbane',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).split('/').reverse().join('-')
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const today    = brisbaneDate(0)
  const weekAgo  = brisbaneDate(-7)

  // ── 1. Job assignments that exist but weren't completed ───────────────────
  const { data: incompleteJobs, error: jobsError } = await (supabase as any)
    .from('job_assignments')
    .select('id, scheduled_date, status, client_id, clients(business_name, suburb), client_sites(site_name), profiles(full_name, user_id)')
    .gte('scheduled_date', weekAgo)
    .lt('scheduled_date', today)
    .neq('status', 'completed')
    .order('scheduled_date', { ascending: true })

  if (jobsError) {
    console.error('weekly-incomplete-jobs: jobs query error', jobsError)
    return NextResponse.json({ error: jobsError.message }, { status: 500 })
  }

  // Build a lookup of clientId::date → true for any existing job record
  const existingJobKeys = new Set<string>()
  for (const job of incompleteJobs ?? []) {
    existingJobKeys.add(`${job.client_id}::${job.scheduled_date}`)
  }

  // Also grab completed jobs so we don't flag those dates as missing
  const { data: completedJobs } = await (supabase as any)
    .from('job_assignments')
    .select('client_id, scheduled_date')
    .gte('scheduled_date', weekAgo)
    .lt('scheduled_date', today)
    .eq('status', 'completed')

  for (const job of completedJobs ?? []) {
    existingJobKeys.add(`${job.client_id}::${job.scheduled_date}`)
  }

  // ── 2. Scheduled dates with no job record at all ──────────────────────────
  const { data: scheduleClients } = await (supabase as any)
    .from('clients')
    .select('id, business_name, suburb, frequency, service_days, start_date, profiles!assigned_cleaner_id(full_name)')
    .eq('active', true)
    .eq('is_multi_site', false)
    .not('frequency', 'is', null)

  type MissingItem = { clientName: string; suburb: string | null; cleanerName: string | null; date: string }
  const missingRecords: MissingItem[] = []

  const fromDate = new Date(weekAgo + 'T00:00:00')

  for (const client of scheduleClients ?? []) {
    if (!(client.service_days ?? []).length) continue
    const dates = getUpcomingDates(
      {
        id: client.id,
        business_name: client.business_name,
        address: null,
        suburb: client.suburb ?? null,
        frequency: client.frequency,
        service_days: client.service_days,
        start_date: client.start_date ?? null,
      },
      8,
      fromDate,
    )
    for (const d of dates) {
      const dateStr = d.toISOString().split('T')[0]
      if (dateStr >= today) continue
      const key = `${client.id}::${dateStr}`
      if (!existingJobKeys.has(key)) {
        missingRecords.push({
          clientName:  client.business_name,
          suburb:      client.suburb ?? null,
          cleanerName: client.profiles?.full_name ?? null,
          date:        dateStr,
        })
      }
    }
  }

  missingRecords.sort((a, b) => a.date.localeCompare(b.date))

  const incompleteList  = (incompleteJobs ?? []) as any[]
  const totalIssues     = incompleteList.length + missingRecords.length

  // ── Nothing to report ─────────────────────────────────────────────────────
  if (totalIssues === 0) {
    return NextResponse.json({ sent: false, reason: 'All jobs completed this week — no report needed' })
  }

  // ── Build email ───────────────────────────────────────────────────────────
  const periodLabel = `${formatDate(weekAgo)} – ${formatDate(
    new Date(new Date(today + 'T00:00:00').getTime() - 86_400_000).toISOString().split('T')[0]
  )}`

  const incompleteRows = incompleteList.map((j: any) => {
    const client  = j.clients?.business_name ?? 'Unknown'
    const suburb  = j.clients?.suburb ? ` (${j.clients.suburb})` : ''
    const cleaner = j.profiles?.full_name ?? 'No cleaner assigned'
    const status  = j.status === 'not_started' ? 'Never started' : 'Started but not submitted'
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-weight:600;color:#111827;">${client}${suburb}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#6b7280;">${formatDate(j.scheduled_date)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#6b7280;">${cleaner}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;">
        <span style="background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;">${status}</span>
      </td>
    </tr>`
  }).join('')

  const missingRows = missingRecords.map((item) => {
    const suburb  = item.suburb ? ` (${item.suburb})` : ''
    const cleaner = item.cleanerName ?? 'No cleaner assigned'
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-weight:600;color:#111827;">${item.clientName}${suburb}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#6b7280;">${formatDate(item.date)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#6b7280;">${cleaner}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;">
        <span style="background:#fef3c7;color:#b45309;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;">No record created</span>
      </td>
    </tr>`
  }).join('')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://portal.deltacleaning.com.au'

  const jobCards = incompleteList.map((j: any) => {
    const site    = j.client_sites?.site_name
    const label   = site ? `${j.clients?.business_name ?? 'a client'} — ${site}` : (j.clients?.business_name ?? 'a client')
    const cleaner = j.profiles?.full_name ?? 'No cleaner assigned'
    return `
      <div style="border:1px solid #eef2f6;border-radius:10px;padding:12px 14px;margin-bottom:10px;">
        <p style="margin:0;font-weight:700;color:#0f172a;font-size:14px;">${label}</p>
        <p style="margin:4px 0 0;color:#64748b;font-size:12px;">${cleaner} · ${formatDate(j.scheduled_date)}</p>
      </div>`
  }).join('')

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;padding:28px 18px;color:#0f172a;">
      <div style="background:#0b1320;border-radius:12px 12px 0 0;padding:22px 26px;">
        <p style="margin:0;color:#93c5fd;font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;">Delta Cleaning · Alert</p>
        <h1 style="margin:6px 0 0;color:#fff;font-size:20px;">${totalIssues} clean${totalIssues !== 1 ? 's' : ''} not marked off</h1>
      </div>
      <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:26px;">
        <p style="font-size:13px;color:#64748b;margin:0 0 16px;">Mark each off if it was done — keeps billing and reports accurate.</p>
        ${jobCards}
        ${missingRecords.length ? `<p style="font-size:12px;color:#94a3b8;margin:14px 0 0;">+ ${missingRecords.length} scheduled clean${missingRecords.length !== 1 ? 's' : ''} with no job record.</p>` : ''}
        <a href="${appUrl}/dashboard" style="display:inline-block;margin-top:18px;background:#0b1320;color:#fff;text-decoration:none;font-size:14px;font-weight:700;border-radius:10px;padding:12px 22px;">Mark it off →</a>
        <p style="font-size:11px;color:#94a3b8;margin:22px 0 0;border-top:1px solid #f1f5f9;padding-top:14px;">Sent Monday mornings · Delta Cleaning Operations Hub</p>
      </div>
    </div>
  `

  // Admin only — managers and cleaners are intentionally NOT notified about missed jobs.
  sendPushToRole('admin', {
    title: `${totalIssues} clean${totalIssues !== 1 ? 's' : ''} not marked off`,
    body: [
      incompleteList.length ? `${incompleteList.length} not completed` : '',
      missingRecords.length ? `${missingRecords.length} with no record` : '',
    ].filter(Boolean).join(' · ') || 'Review the weekly job report.',
    url: '/dashboard',
  }).catch(() => {})

  const subject = `Missed cleans — ${totalIssues} to mark off (${periodLabel})`
  const result  = await sendEmail(REPORT_EMAIL, subject, html)

  return NextResponse.json({
    sent:         result.success,
    totalIssues,
    incomplete:   incompleteList.length,
    noRecord:     missingRecords.length,
    recipient:    REPORT_EMAIL,
    error:        result.error,
  })
}
