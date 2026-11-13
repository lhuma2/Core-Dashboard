import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import { sendPushToRole } from '@/lib/push'
import { allCrewJobs } from '@/lib/crew/all-jobs'

// Vercel cron: runs every Monday at 8 AM Brisbane time (Monday 22:00 UTC Sun)
// Sends a weekly summary of the cleans in the past 7 days that weren't finished in the new cleaner app
// (commercial sites, homes and End of Lease, from the same schedule the app shows).

const REPORT_EMAIL = 'admin@corecleaning.services'

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

  const today   = brisbaneDate(0)
  const weekAgo = brisbaneDate(-7)

  // Every clean booked in the last 7 days (not today) that wasn't finished in the cleaner app. A clean with two
  // cleaners shows once, with both names.
  type Item = { label: string; cleaners: string[]; date: string; started: boolean }
  const byKey = new Map<string, Item>()
  for (const { me, jobs } of await allCrewJobs(weekAgo, 7)) {
    for (const j of jobs) {
      if (j.iso >= today || j.status === 'done') continue
      const it = byKey.get(j.key) ?? { label: j.name, cleaners: [], date: j.iso, started: j.status === 'in_progress' }
      it.cleaners.push(me.name)
      byKey.set(j.key, it)
    }
  }
  const items = Array.from(byKey.values()).sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label))
  const totalIssues = items.length

  // ── Nothing to report ─────────────────────────────────────────────────────
  if (totalIssues === 0) {
    return NextResponse.json({ sent: false, reason: 'All cleans finished this week, no report needed' })
  }

  // ── Build email ───────────────────────────────────────────────────────────
  const periodLabel = `${formatDate(weekAgo)} – ${formatDate(
    new Date(new Date(today + 'T00:00:00').getTime() - 86_400_000).toISOString().split('T')[0]
  )}`

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://portal.corecleaning.services'

  const jobCards = items.map(j => `
      <div style="border:1px solid #eef2f6;border-radius:10px;padding:12px 14px;margin-bottom:10px;">
        <p style="margin:0;font-weight:700;color:#0f172a;font-size:14px;">${j.label}</p>
        <p style="margin:4px 0 0;color:#64748b;font-size:12px;">${j.cleaners.join(' and ')} · ${formatDate(j.date)} · ${j.started ? 'started, not finished' : 'not started'}</p>
      </div>`).join('')

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;padding:28px 18px;color:#0f172a;">
      <div style="background:#00250e;border-radius:12px 12px 0 0;padding:22px 26px;">
        <p style="margin:0;color:#93c5fd;font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;">Core Cleaning · Alert</p>
        <h1 style="margin:6px 0 0;color:#fff;font-size:20px;">${totalIssues} clean${totalIssues !== 1 ? 's' : ''} not marked off</h1>
      </div>
      <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:26px;">
        <p style="font-size:13px;color:#64748b;margin:0 0 16px;">These weren't finished in the cleaner app. Check with the cleaner whether each one was done.</p>
        ${jobCards}
        <a href="${appUrl}/hub" style="display:inline-block;margin-top:18px;background:#00250e;color:#fff;text-decoration:none;font-size:14px;font-weight:700;border-radius:10px;padding:12px 22px;">Open the hub</a>
        <p style="font-size:11px;color:#94a3b8;margin:22px 0 0;border-top:1px solid #f1f5f9;padding-top:14px;">Sent Monday mornings · Core Cleaning Operations Hub</p>
      </div>
    </div>
  `

  // Admin only — managers and cleaners are intentionally NOT notified about missed jobs.
  sendPushToRole('admin', {
    title: `${totalIssues} clean${totalIssues !== 1 ? 's' : ''} not marked off`,
    body: 'Check the weekly report in your email.',
    url: '/hub',
  }).catch(() => {})

  const subject = `Missed cleans — ${totalIssues} to mark off (${periodLabel})`
  const result  = await sendEmail(REPORT_EMAIL, subject, html)

  return NextResponse.json({
    sent:         result.success,
    totalIssues,
    recipient:    REPORT_EMAIL,
    error:        result.error,
  })
}
