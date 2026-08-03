import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Vercel cron: runs daily at 3 AM Brisbane time (17:00 UTC).
// Residential cleans are standalone jobs (not ongoing commercial clients) —
// 2 months after a residential clean is marked completed, this permanently
// deletes the residential_jobs row and its before/after photos (DB row +
// storage file). Mirrors bond-job-cleanup exactly. Scoped strictly to
// residential_jobs / job_kind='residential_job' — never touches
// job_assignments, bond_jobs, or commercial clients.

const BUCKET = 'job-photos'

function twoMonthsAgoISO(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 2)
  return d.toISOString()
}

export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient() as any
  const cutoff = twoMonthsAgoISO()

  const { data: expired, error: fetchError } = await db
    .from('residential_jobs')
    .select('id')
    .eq('status', 'completed')
    .lt('finished_at', cutoff)

  if (fetchError) {
    console.error('residential-job-cleanup: fetch error', fetchError)
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  const jobIds = (expired ?? []).map((j: any) => j.id)
  if (jobIds.length === 0) {
    return NextResponse.json({ deleted: 0, photosDeleted: 0, reason: 'No completed residential cleans older than 2 months' })
  }

  const { data: photos, error: photosError } = await db
    .from('job_photos')
    .select('storage_path')
    .eq('job_kind', 'residential_job')
    .in('job_id', jobIds)

  if (photosError) {
    console.error('residential-job-cleanup: photos fetch error', photosError)
    return NextResponse.json({ error: photosError.message }, { status: 500 })
  }

  const paths = (photos ?? []).map((p: any) => p.storage_path).filter(Boolean)
  let photosDeleted = 0
  for (let i = 0; i < paths.length; i += 100) {
    const chunk = paths.slice(i, i + 100)
    const { error: removeError } = await db.storage.from(BUCKET).remove(chunk)
    if (removeError) console.error('residential-job-cleanup: storage remove error', removeError)
    else photosDeleted += chunk.length
  }

  if (paths.length > 0) {
    await db.from('job_photos').delete().eq('job_kind', 'residential_job').in('job_id', jobIds)
  }

  const { error: deleteError } = await db.from('residential_jobs').delete().in('id', jobIds)
  if (deleteError) {
    console.error('residential-job-cleanup: residential_jobs delete error', deleteError)
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ deleted: jobIds.length, photosDeleted, cutoff })
}
