import { NextResponse } from 'next/server'
import { sendPushToUser } from '@/lib/push'
import { allCrewJobs } from '@/lib/crew/all-jobs'
import { isoAdd } from '@/lib/hub/timetable'

// Push reminders to cleaners to START (morning) and FINISH (evening) their cleans, from the new cleaner app's
// schedule (commercial sites, homes and End of Lease). Runs twice daily; the Brisbane hour decides which pass.
// Quiet hours 20:00–07:00. Morning: a clean booked today that isn't started. Evening: a clean started in the last
// 2 days that isn't finished (a Saturday clean carried into Sunday included).

function brisbane() {
  const now = new Date()
  const date = now.toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-')
  const hour = parseInt(now.toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', hour: '2-digit', hour12: false }), 10)
  return { date, hour }
}

export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { date: today, hour } = brisbane()
  if (hour < 7 || hour >= 20) return NextResponse.json({ skipped: 'quiet hours', hour })

  const pass = hour < 14 ? 'start' : 'finish'
  let sent = 0
  const crews = pass === 'start' ? await allCrewJobs(today, 1) : await allCrewJobs(isoAdd(today, -2), 3)
  for (const { me, jobs } of crews) {
    for (const j of jobs) {
      if (pass === 'start' ? j.iso !== today || j.status !== 'booked' : j.status !== 'in_progress') continue
      await sendPushToUser(me.userId, pass === 'start'
        ? { title: 'Time to start your clean', body: `${j.name} is on today. Tap to start when you arrive.`, url: '/cleaner/app' }
        : { title: "Don't forget to finish", body: `Your clean at ${j.name} is still open. Tap to finish it.`, url: '/cleaner/app' })
      sent++
    }
  }
  return NextResponse.json({ pass, sent, today, hour })
}
