import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendFollowUpEmailAction } from '@/actions/cold-leads'

// Runs weekday mornings (Brisbane). Sends a single, light follow-up email to any
// cold lead that got the intro email 5+ days ago and hasn't been followed up yet
// and is still active (called / follow-up). We can't detect actual replies, so if
// a lead has moved on (booked / won / not interested) it's skipped — and it only
// ever sends ONE follow-up (follow_up_email_sent_at gates it).

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient() as any
  const cutoff = new Date(Date.now() - 5 * 86_400_000).toISOString()

  const { data: leads, error } = await db
    .from('cold_leads')
    .select('id, status, intro_email_sent_at, follow_up_email_sent_at, intro_email_message_id')
    .not('intro_email_sent_at', 'is', null)
    .is('follow_up_email_sent_at', null)
    .lte('intro_email_sent_at', cutoff)
    .in('status', ['called', 'follow_up'])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let sent = 0
  const failures: string[] = []
  for (const lead of leads ?? []) {
    if (!lead.intro_email_message_id) continue   // can't thread → skip
    const res = await sendFollowUpEmailAction(lead.id)
    if (res?.error) failures.push(`${lead.id}: ${res.error}`)
    else sent++
  }

  return NextResponse.json({ sent, considered: (leads ?? []).length, failures })
}
