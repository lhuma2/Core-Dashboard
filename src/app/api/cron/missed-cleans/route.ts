import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'

// Vercel cron: runs daily at 9 PM Brisbane time (11:00 UTC)
// Finds jobs from yesterday that were never completed and emails admin + managers

function brisbaneYesterday(): string {
  const d = new Date(Date.now() - 86_400_000)
  return d.toLocaleString('en-AU', {
    timeZone: 'Australia/Brisbane',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).split('/').reverse().join('-')
}

export async function GET(request: Request) {
  // Verify the request is from Vercel Cron
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase     = createAdminClient()
  const yesterday    = brisbaneYesterday()

  // Find all jobs from yesterday that were never completed
  const { data: missedJobs, error } = await (supabase as any)
    .from('job_assignments')
    .select('id, scheduled_date, clients(business_name, suburb), profiles(full_name, email)')
    .eq('scheduled_date', yesterday)
    .eq('status', 'not_started')

  if (error) {
    console.error('Cron missed-cleans error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!missedJobs || missedJobs.length === 0) {
    return NextResponse.json({ sent: false, reason: 'No missed cleans yesterday' })
  }

  // Build email body
  const dateLabel = new Date(yesterday + 'T00:00:00').toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const rows = missedJobs.map((j: any) => {
    const client  = j.clients?.business_name ?? 'Unknown client'
    const suburb  = j.clients?.suburb ? ` (${j.clients.suburb})` : ''
    const cleaner = j.profiles?.full_name ?? 'No cleaner assigned'
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-weight:600;">${client}${suburb}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#6b7280;">${cleaner}</td>
    </tr>`
  }).join('')

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 20px;color:#111;">
      <div style="background:#1e3a5f;padding:20px 24px;border-radius:8px 8px 0 0;">
        <h2 style="color:white;margin:0;font-size:18px;">⚠️ Missed Cleans — ${dateLabel}</h2>
      </div>
      <div style="background:white;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
        <p style="font-size:14px;color:#374151;margin-top:0;">
          The following ${missedJobs.length} clean${missedJobs.length !== 1 ? 's' : ''}
          were scheduled for <strong>${dateLabel}</strong> but were not marked as completed.
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;">Client</th>
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;">Cleaner</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="font-size:13px;color:#6b7280;margin-top:20px;">
          Log in to the portal to review and mark these jobs as complete if they were done.
        </p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://portal.deltacleaning.com.au'}/dashboard"
           style="display:inline-block;margin-top:8px;background:#1e3a5f;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;">
          View Dashboard →
        </a>
      </div>
    </div>
  `

  // Get all manager emails
  const { data: managers } = await (supabase as any)
    .from('profiles')
    .select('email')
    .eq('role', 'manager')
    .not('email', 'ilike', '%@delta-cleaner.internal')

  const recipients: string[] = ['hello@deltacleaning.com.au']
  for (const m of managers ?? []) {
    if (m.email && !recipients.includes(m.email)) {
      recipients.push(m.email)
    }
  }

  const subject = `⚠️ ${missedJobs.length} Missed Clean${missedJobs.length !== 1 ? 's' : ''} — ${dateLabel}`

  const results = await Promise.allSettled(
    recipients.map((to) => sendEmail(to, subject, html))
  )

  const sent = results.filter((r) => r.status === 'fulfilled' && (r.value as any).success).length

  return NextResponse.json({
    sent: true,
    missedCount: missedJobs.length,
    emailsSent: sent,
    recipients,
  })
}
