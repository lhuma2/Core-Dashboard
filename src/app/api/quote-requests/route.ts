import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToRole } from '@/lib/push'
import { hasTemplate, type TemplateDocData } from '@/lib/documents/template'
import {
  CLIENT_TYPE_FOR_KIND, QUOTE_REQUEST_KIND_LABELS, kindOfRequest, pickTemplate, valuesFromRequest,
  type QuoteRequest,
} from '@/lib/documents/quote-request'

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

  const kind = kindOfRequest(req)
  if (!kind) return NextResponse.json({ skipped: `"${req.service || 'No service'}" isn't a service the hub drafts quotes for` })

  const db = createAdminClient() as any
  const { data: docs, error: docsErr } = await db.from('company_documents').select('id, name, file_url, template')
  if (docsErr) return NextResponse.json({ error: docsErr.message }, { status: 500 })
  const cd = pickTemplate<{ id: string; name: string; file_url: string; template: any }>(docs ?? [], kind)
  if (!cd) {
    const names = (docs ?? []).filter((d: any) => hasTemplate(d.template)).map((d: any) => d.name)
    return NextResponse.json({
      skipped: `No template is set for ${QUOTE_REQUEST_KIND_LABELS[kind]} requests. `
        + (names.length ? `Templates found: ${names.join(', ')}. Choose one under "Website quote requests" on its setup screen.` : 'No company documents have template fields yet.'),
    })
  }

  const ref = `DC-PROP-${Math.floor(1000 + Math.random() * 8999)}`
  const data: TemplateDocData = {
    clientName: req.name,
    refNumber: ref,
    templateId: cd.id,
    templateName: cd.name,
    template: cd.template,
    values: valuesFromRequest(cd.template, req, ref),
    clientType: CLIENT_TYPE_FOR_KIND[kind],
    quoteRequest: { ...req, kind },
  }
  const { data: row, error } = await db.from('proposal_documents').insert({
    kind: 'proposal',
    status: 'draft',
    ref_number: ref,
    client_name: req.name,
    pdf_url: cd.file_url,
    signer_email: req.email,
    data,
  }).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await sendPushToRole('admin', {
    title: `New quote request: ${req.name}`,
    body: `${QUOTE_REQUEST_KIND_LABELS[kind]} draft is ready. Add the prices and send.`,
    url: `/documents/${row.id}`,
  }).catch(() => {})

  revalidatePath('/documents')
  return NextResponse.json({ success: true, id: row.id, template: cd.name })
}
