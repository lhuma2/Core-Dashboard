import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToRole } from '@/lib/push'
import { QUOTE_REQUEST_KIND_LABELS, type QuoteRequest } from '@/lib/documents/quote-request'
import { draftFromRequest } from '@/lib/documents/quote-request-draft'

// A new quote request from the website's quote form. Makes a draft proposal from
// the matching template, prefilled with everything but the prices, and lets the
// owner know. The website still emails the request as before; this is on top.

function authorised(request: Request): boolean {
  // Trimmed: a pasted value often carries a stray space or newline.
  const secret = process.env.QUOTE_REQUEST_SECRET?.trim()
  if (!secret) return false
  const got = Buffer.from((request.headers.get('authorization') ?? '').trim())
  const want = Buffer.from(`Bearer ${secret}`)
  return got.length === want.length && timingSafeEqual(got, want)
}

const str = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export async function POST(request: Request) {
  try {
    return await handle(request)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Unexpected error' }, { status: 500 })
  }
}

async function handle(request: Request) {
  if (!process.env.QUOTE_REQUEST_SECRET?.trim()) {
    return NextResponse.json({ error: 'QUOTE_REQUEST_SECRET is not set on the hub' }, { status: 503 })
  }
  if (!authorised(request)) return NextResponse.json({ error: 'The secret does not match the hub\'s QUOTE_REQUEST_SECRET' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const req: QuoteRequest = {
    name: str(body?.name, 120),
    email: str(body?.email, 200),
    phone: str(body?.phone, 40),
    service: str(body?.service, 80),
    region: str(body?.region, 80) || undefined,
    message: str(body?.message, 2000) || undefined,
    fields: (Array.isArray(body?.fields) ? body.fields : [])
      .slice(0, 40)
      .map((f: any) => ({ label: str(f?.label, 80), value: str(f?.value, 500) }))
      .filter((f: { label: string; value: string }) => f.label && f.value),
    receivedAt: new Date().toISOString(),
  }
  if (!req.name || !req.email) return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })

  const db = createAdminClient() as any
  const res = await draftFromRequest(db, req)
  if ('error' in res) return NextResponse.json({ error: res.error }, { status: 500 })
  if ('skipped' in res) return NextResponse.json({ skipped: res.skipped })
  const row = res, kind = res.kind

  await sendPushToRole('admin', {
    title: `New quote request: ${req.name}`,
    body: `${QUOTE_REQUEST_KIND_LABELS[kind]} draft is ready. Add the prices and send.`,
    url: `/documents/${row.id}`,
  }).catch(() => {})

  revalidatePath('/documents')
  return NextResponse.json({ success: true, id: row.id, template: res.template })
}
