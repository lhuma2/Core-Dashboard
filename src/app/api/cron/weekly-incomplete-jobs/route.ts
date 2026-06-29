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
    .select('id, scheduled_date, status, client_id, clients(business_name, suburb), profiles(full_name)')
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

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:32px 20px;color:#111;">
      <div style="background:#1e3a5f;padding:20px 24px;border-radius:8px 8px 0 0;">
        <h2 style="color:white;margin:0;font-size:18px;">📋 Weekly Job Report — ${periodLabel}</h2>
        <p style="color:#93c5fd;margin:6px 0 0;font-size:13px;">Jobs not marked complete</p>
      </div>
      <div style="background:white;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">

        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:12px 16px;margin-bottom:20px;">
          <p style="margin:0;font-size:14px;color:#991b1b;font-weight:600;">
            ${totalIssues} incomplete job${totalIssues !== 1 ? 's' : ''} found this week
          </p>
          <p style="margin:4px 0 0;font-size:12px;color:#b91c1c;">
            Review each one and mark as complete if the clean was done.
          </p>
        </div>

        ${incompleteList.length > 0 ? `
        <h3 style="font-size:13px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px;">
          Job records not completed (${incompleteList.length})
        </h3>
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:700;border-bottom:1px solid #e5e7eb;text-transform:uppercase;">Client</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:700;border-bottom:1px solid #e5e7eb;text-transform:uppercase;">Date</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:700;border-bottom:1px solid #e5e7eb;text-transform:uppercase;">Cleaner</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:700;border-bottom:1px solid #e5e7eb;text-transform:uppercase;">Status</th>
            </tr>
          </thead>
          <tbody>${incompleteRows}</tbody>
        </table>
        ` : ''}

        ${missingRecords.length > 0 ? `
        <h3 style="font-size:13px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px;">
          Scheduled cleans with no job record (${missingRecords.length})
        </h3>
        <p style="font-size:12px;color:#6b7280;margin:0 0 8px;">These dates appeared on the client's schedule but no job was ever created or assigned.</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:700;border-bottom:1px solid #e5e7eb;text-transform:uppercase;">Client</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:700;border-bottom:1px solid #e5e7eb;text-transform:uppercase;">Date</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:700;border-bottom:1px solid #e5e7eb;text-transform:uppercase;">Assigned Cleaner</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:700;border-bottom:1px solid #e5e7eb;text-transform:uppercase;">Status</th>
            </tr>
          </thead>
          <tbody>${missingRows}</tbody>
        </table>
        ` : ''}

        <a href="${appUrl}/dashboard"
           style="display:inline-block;background:#1e3a5f;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;">
          Go to Dashboard →
        </a>

        <p style="font-size:11px;color:#9ca3af;margin-top:20px;border-top:1px solid #f3f4f6;padding-top:16px;">
          Sent every Monday morning · Delta Cleaning Operations Hub
        </p>
      </div>
    </div>
  `

  // Push heads-up to managers + admins (the detailed email is kept below).
  const pushNote = {
    title: `📋 ${totalIssues} incomplete job${totalIssues !== 1 ? 's' : ''} this week`,
    body: [
      incompleteList.length ? `${incompleteList.length} not completed` : '',
      missingRecords.length ? `${missingRecords.length} with no record` : '',
    ].filter(Boolean).join(' · ') || 'Review the weekly job report.',
    url: '/dashboard',
  }
  sendPushToRole('manager', pushNote).catch(() => {})
  sendPushToRole('admin', pushNote).catch(() => {})

  const subject = `📋 Weekly Report: ${totalIssues} incomplete job${totalIssues !== 1 ? 's' : ''} (${periodLabel})`
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
