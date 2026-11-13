import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { brisbaneToday } from '@/lib/hub/figures'
import { isoAdd } from '@/lib/hub/timetable'

// Vercel cron, daily at 2am Brisbane (16:00 UTC). Completion photos from the new cleaner app are kept for 7 days after
// each clean (End of Lease: 21 days), then deleted: the file from the private clean-photos bucket first, then the row.
// A photo that arrives late for an old clean goes on the next run. Never touches the old job_photos / job-photos.
const BUCKET = 'clean-photos'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const db = createAdminClient() as any
  const today = brisbaneToday()
  let removed = 0
  for (const [kinds, keep] of [[['commercial', 'residential'], 7], [['eol'], 21]] as const) {
    for (let round = 0; round < 20; round++) {
      const { data, error } = await db.from('clean_photos').select('id, path').in('kind', kinds as unknown as string[]).lte('clean_date', isoAdd(today, -keep)).limit(500)
      if (error) return NextResponse.json({ error: error.message, removed }, { status: 500 })
      if (!data?.length) break
      const rm = await db.storage.from(BUCKET).remove(data.map((p: any) => p.path))
      if (rm.error) return NextResponse.json({ error: rm.error.message, removed }, { status: 500 })
      const del = await db.from('clean_photos').delete().in('id', data.map((p: any) => p.id))
      if (del.error) return NextResponse.json({ error: del.error.message, removed }, { status: 500 })
      removed += data.length
    }
  }
  return NextResponse.json({ ok: true, removed })
}
