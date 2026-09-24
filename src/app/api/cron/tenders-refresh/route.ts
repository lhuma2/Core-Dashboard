import { NextResponse } from 'next/server'
import { refreshTenders } from '@/lib/tenders/refresh'

// Vercel cron: keeps the /tenders board topped up to 10 — expires anything
// past its close date, promotes buffered candidates, and re-fetches from
// AusTender + QTenders when the buffer runs low.

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await refreshTenders()
    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Refresh failed' }, { status: 500 })
  }
}
