import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const SUPABASE_URL     = 'https://oaqkgyebmahfogjhzupf.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hcWtneWVibWFoZm9namh6dXBmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTc5NjYzMCwiZXhwIjoyMDkxMzcyNjMwfQ.s87TmQNHHivZxQs-Uy3ERStp-QXHsa8swyBaMJRBF2E'
const RESEND_API_KEY   = 're_eEjkHmRg_55EznQZXs4M5rnhUUcqpuo4f'
const REPORT_EMAIL     = 'hello@deltacleaning.com.au'
const APP_URL          = 'https://delta-operations-hub.vercel.app'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
const resend   = new Resend(RESEND_API_KEY)

function brisbaneDate(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86_400_000)
  return d.toLocaleString('en-AU', {
    timeZone: 'Australia/Brisbane',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).split('/').reverse().join('-')
}

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

const DAY_NUM = { sun:0,mon:1,tue:2,wed:3,thu:4,fri:5,sat:6,sunday:0,monday:1,tuesday:2,wednesday:3,thursday:4,friday:5,saturday:6 }

function getUpcomingDates(client, daysAhead = 60, fromDate) {
  const days = (client.service_days ?? []).map(d => DAY_NUM[d.toLowerCase()]).filter(n => n !== undefined)
  const freq = client.frequency ?? ''
  if (days.length === 0 || !freq || freq === 'adhoc') return []
  const anchor = client.start_date ? new Date(client.start_date + 'T00:00:00') : new Date()
  anchor.setHours(0,0,0,0)
  const today = fromDate ? new Date(fromDate) : new Date()
  today.setHours(0,0,0,0)
  const end = new Date(today)
  end.setDate(end.getDate() + daysAhead)
  const results = []
  const cursor  = new Date(today)
  while (cursor <= end) {
    const dow = cursor.getDay()
    if (days.includes(dow)) {
      const weeksSince = Math.round((cursor - anchor) / (7*24*60*60*1000))
      let include = false
      switch (freq) {
        case 'daily': case 'weekly': case 'twice_weekly': case 'three_weekly': include = true; break
        case 'fortnightly': include = weeksSince % 2 === 0; break
        case 'four_weekly': include = weeksSince % 4 === 0; break
        case 'monthly': include = cursor.getDate() <= 7; break
        case 'quarterly': include = [0,3,6,9].includes(cursor.getMonth()) && cursor.getDate() <= 7; break
        case 'annual': include = cursor.getMonth() === 0 && cursor.getDate() <= 7; break
      }
      if (include) results.push(new Date(cursor))
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return results
}

async function run() {
  const today   = brisbaneDate(0)
  const weekAgo = brisbaneDate(-7)

  console.log(`Checking ${weekAgo} → ${today}`)

  const { data: incompleteJobs, error: jobsError } = await supabase
    .from('job_assignments')
    .select('id, scheduled_date, status, client_id, clients(business_name, suburb), profiles(full_name)')
    .gte('scheduled_date', weekAgo)
    .lt('scheduled_date', today)
    .neq('status', 'completed')
    .order('scheduled_date', { ascending: true })

  if (jobsError) { console.error('Jobs query error:', jobsError); process.exit(1) }
  console.log(`Incomplete job records: ${incompleteJobs?.length ?? 0}`)

  const existingKeys = new Set()
  for (const j of incompleteJobs ?? []) existingKeys.add(`${j.client_id}::${j.scheduled_date}`)
  const { data: completedJobs } = await supabase
    .from('job_assignments')
    .select('client_id, scheduled_date')
    .gte('scheduled_date', weekAgo)
    .lt('scheduled_date', today)
    .eq('status', 'completed')
  for (const j of completedJobs ?? []) existingKeys.add(`${j.client_id}::${j.scheduled_date}`)

  const { data: scheduleClients } = await supabase
    .from('clients')
    .select('id, business_name, suburb, frequency, service_days, start_date, profiles!assigned_cleaner_id(full_name)')
    .eq('active', true)
    .eq('is_multi_site', false)
    .not('frequency', 'is', null)

  const missingRecords = []
  const fromDate = new Date(weekAgo + 'T00:00:00')
  for (const client of scheduleClients ?? []) {
    if (!(client.service_days ?? []).length) continue
    const dates = getUpcomingDates({ ...client, address: null, suburb: client.suburb ?? null, start_date: client.start_date ?? null }, 8, fromDate)
    for (const d of dates) {
      const dateStr = d.toISOString().split('T')[0]
      if (dateStr >= today) continue
      if (!existingKeys.has(`${client.id}::${dateStr}`)) {
        missingRecords.push({ clientName: client.business_name, suburb: client.suburb ?? null, cleanerName: client.profiles?.full_name ?? null, date: dateStr })
      }
    }
  }
  missingRecords.sort((a,b) => a.date.localeCompare(b.date))
  console.log(`Schedule gaps (no record): ${missingRecords.length}`)

  const totalIssues = (incompleteJobs?.length ?? 0) + missingRecords.length

  if (totalIssues === 0) {
    console.log('All jobs completed this week — no email needed.')
    return
  }

  const periodLabel = `${formatDate(weekAgo)} – ${formatDate(brisbaneDate(-1))}`

  const incompleteRows = (incompleteJobs ?? []).map(j => {
    const client  = j.clients?.business_name ?? 'Unknown'
    const suburb  = j.clients?.suburb ? ` (${j.clients.suburb})` : ''
    const cleaner = j.profiles?.full_name ?? 'No cleaner assigned'
    const status  = j.status === 'not_started' ? 'Never started' : 'Started but not submitted'
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-weight:600;color:#111827;">${client}${suburb}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#6b7280;">${formatDate(j.scheduled_date)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#6b7280;">${cleaner}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;"><span style="background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;">${status}</span></td>
    </tr>`
  }).join('')

  const missingRows = missingRecords.map(item => {
    const suburb  = item.suburb ? ` (${item.suburb})` : ''
    const cleaner = item.cleanerName ?? 'No cleaner assigned'
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-weight:600;color:#111827;">${item.clientName}${suburb}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#6b7280;">${formatDate(item.date)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#6b7280;">${cleaner}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;"><span style="background:#fef3c7;color:#b45309;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;">No record created</span></td>
    </tr>`
  }).join('')

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:32px 20px;color:#111;">
      <div style="background:#1e3a5f;padding:20px 24px;border-radius:8px 8px 0 0;">
        <h2 style="color:white;margin:0;font-size:18px;">📋 Weekly Job Report — ${periodLabel}</h2>
        <p style="color:#93c5fd;margin:6px 0 0;font-size:13px;">Jobs not marked complete</p>
      </div>
      <div style="background:white;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:12px 16px;margin-bottom:20px;">
          <p style="margin:0;font-size:14px;color:#991b1b;font-weight:600;">${totalIssues} incomplete job${totalIssues !== 1 ? 's' : ''} found this week</p>
          <p style="margin:4px 0 0;font-size:12px;color:#b91c1c;">Review each one and mark as complete if the clean was done.</p>
        </div>
        ${(incompleteJobs?.length ?? 0) > 0 ? `
        <h3 style="font-size:13px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px;">Job records not completed (${incompleteJobs.length})</h3>
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px;">
          <thead><tr style="background:#f9fafb;">
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:700;border-bottom:1px solid #e5e7eb;text-transform:uppercase;">Client</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:700;border-bottom:1px solid #e5e7eb;text-transform:uppercase;">Date</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:700;border-bottom:1px solid #e5e7eb;text-transform:uppercase;">Cleaner</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:700;border-bottom:1px solid #e5e7eb;text-transform:uppercase;">Status</th>
          </tr></thead>
          <tbody>${incompleteRows}</tbody>
        </table>` : ''}
        ${missingRecords.length > 0 ? `
        <h3 style="font-size:13px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px;">Scheduled cleans with no job record (${missingRecords.length})</h3>
        <p style="font-size:12px;color:#6b7280;margin:0 0 8px;">These dates appeared on the client's schedule but no job was ever created or assigned.</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px;">
          <thead><tr style="background:#f9fafb;">
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:700;border-bottom:1px solid #e5e7eb;text-transform:uppercase;">Client</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:700;border-bottom:1px solid #e5e7eb;text-transform:uppercase;">Date</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:700;border-bottom:1px solid #e5e7eb;text-transform:uppercase;">Assigned Cleaner</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:700;border-bottom:1px solid #e5e7eb;text-transform:uppercase;">Status</th>
          </tr></thead>
          <tbody>${missingRows}</tbody>
        </table>` : ''}
        <a href="${APP_URL}/dashboard" style="display:inline-block;background:#1e3a5f;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;">Go to Dashboard →</a>
        <p style="font-size:11px;color:#9ca3af;margin-top:20px;border-top:1px solid #f3f4f6;padding-top:16px;">Sent every Monday morning · Delta Cleaning Operations Hub</p>
      </div>
    </div>
  `

  const subject = `📋 Weekly Report: ${totalIssues} incomplete job${totalIssues !== 1 ? 's' : ''} (${periodLabel})`
  console.log(`Sending to ${REPORT_EMAIL}...`)

  const result = await resend.emails.send({
    from: 'Delta Cleaning <noreply@deltacleaning.com.au>',
    to: REPORT_EMAIL,
    subject,
    html,
  })

  if (result.error) {
    console.error('Send failed:', result.error)
  } else {
    console.log('Email sent! ID:', result.data?.id)
  }
}

run().catch(console.error)
