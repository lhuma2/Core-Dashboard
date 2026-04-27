import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildSchedule } from '@/lib/schedule'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

function dateOnly(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '')
}

function stamp(): string {
  return new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

// Safe ASCII-only escape for ICS values
function esc(s: string): string {
  return s
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '') // strip non-ASCII
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

// RFC 5545 line folding at 75 chars (ASCII-safe after esc())
function line(s: string): string {
  if (s.length <= 75) return s
  const parts: string[] = []
  parts.push(s.slice(0, 75))
  let i = 75
  while (i < s.length) {
    parts.push(' ' + s.slice(i, i + 74))
    i += 74
  }
  return parts.join('\r\n')
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return new NextResponse('Missing token', { status: 400 })

  const supabase = adminSupabase()

  const { data: profile, error } = await (supabase as any)
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', token)
    .single()

  if (error || !profile || profile.role !== 'cleaner') {
    return new NextResponse('Invalid token', { status: 403 })
  }

  const { data: clients } = await (supabase as any)
    .from('clients')
    .select('id, business_name, address, suburb, frequency, service_days, start_date')
    .eq('assigned_cleaner_id', profile.id)
    .eq('active', true)
    .eq('assignment_accepted', true)

  const schedule = buildSchedule(clients ?? [], 90)

  const rows: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Delta Cleaning//Cleaner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]

  for (const ev of schedule) {
    const nextDay = new Date(ev.date)
    nextDay.setUTCDate(nextDay.getUTCDate() + 1)

    rows.push('BEGIN:VEVENT')
    rows.push(line(`UID:${ev.dateStr}-${ev.client.id}@deltacleaning`))
    rows.push(`DTSTAMP:${stamp()}`)
    rows.push(`DTSTART;VALUE=DATE:${dateOnly(ev.date)}`)
    rows.push(`DTEND;VALUE=DATE:${dateOnly(nextDay)}`)
    rows.push(line(`SUMMARY:${esc('Clean - ' + ev.client.business_name)}`))
    const addr = [ev.client.address, ev.client.suburb].filter(Boolean).join(', ')
    if (addr) rows.push(line(`LOCATION:${esc(addr)}`))
    rows.push('END:VEVENT')
  }

  rows.push('END:VCALENDAR')

  return new NextResponse(rows.join('\r\n') + '\r\n', {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
