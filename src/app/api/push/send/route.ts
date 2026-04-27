import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToUser } from '@/lib/push'

export async function POST(req: NextRequest) {
  // Validate cron secret
  const authHeader = req.headers.get('authorization')
  const expected = `Bearer ${process.env.CRON_SECRET}`
  if (authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const admin = createAdminClient()

    // Get today's date in AEST (Brisbane, UTC+10)
    const now = new Date()
    const aestOffset = 10 * 60 * 60 * 1000
    const aestNow = new Date(now.getTime() + aestOffset)
    const today = aestNow.toISOString().split('T')[0]

    // Fetch all jobs scheduled for today that are not completed
    const { data: jobs, error } = await (admin as any)
      .from('job_assignments')
      .select('id, cleaner_id, status, clients(business_name)')
      .eq('scheduled_date', today)
      .neq('status', 'completed')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!jobs?.length) {
      return NextResponse.json({ sent: 0 })
    }

    let sent = 0

    for (const job of jobs) {
      if (!job.cleaner_id) continue

      // Get the cleaner's user_id from profiles
      const { data: profile } = await (admin as any)
        .from('profiles')
        .select('user_id')
        .eq('id', job.cleaner_id)
        .single()

      if (!profile?.user_id) continue

      const clientName = job.clients?.business_name ?? 'a client'

      await sendPushToUser(profile.user_id, {
        title: 'Upcoming Job Reminder',
        body:  `You have a job at ${clientName} today.`,
        url:   `/cleaner/jobs/${job.id}`,
      })

      sent++
    }

    return NextResponse.json({ sent })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Internal error' }, { status: 500 })
  }
}
