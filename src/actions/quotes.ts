'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'
import { sendPushToRole } from '@/lib/push'
import { requireStaff } from '@/lib/require-staff'
import { isTemplateDocData } from '@/lib/documents/template'
import { agreementFromQuote, clientTypeOf, type ClientType } from '@/lib/documents/quote'
import { APP_URL, WORDMARK, EMAIL_RE, auDate, esc, uniqueSignCode } from '@/lib/documents/sign-code'

// ─── Owner: send a template quote for the client to accept ────────────────────
export async function sendQuoteAction(id: string, toEmail: string, message?: string, clientType?: ClientType) {
  const denied = await requireStaff()
  if (denied) return { error: denied }
  const email = (toEmail ?? '').trim()
  if (!EMAIL_RE.test(email)) return { error: 'Enter a valid email address.' }

  const db = createAdminClient() as any
  const { data: doc } = await db.from('proposal_documents')
    .select('id, kind, status, sign_code, data, client_name, pdf_url').eq('id', id).single()
  if (!doc) return { error: 'Document not found.' }
  if (doc.kind !== 'proposal' || !doc.pdf_url || !isTemplateDocData(doc.data)) {
    return { error: 'Only quotes made from a template can be sent for the client to accept.' }
  }
  if (doc.status === 'accepted') return { error: 'This quote has already been accepted.' }

  const name = doc.data.clientName || doc.client_name || 'Quote'
  const code: string = doc.sign_code ?? await uniqueSignCode(db, name)
  const type = clientType ?? clientTypeOf(doc.data)
  const { error } = await db.from('proposal_documents').update({
    sign_code: code, signer_email: email, status: 'sent', sent_at: new Date().toISOString(),
    data: { ...doc.data, quoteMode: true, clientType: type },
  }).eq('id', id)
  if (error) return { error: error.message }

  const link = `${APP_URL}/quote/${code}`
  const res = await sendEmail(email, 'Your Core Cleaning quote', quoteEmail(name, link, message))
  if (!res.success) return { error: res.error ?? 'Could not send the email. Please try again.' }

  revalidatePath('/documents'); revalidatePath(`/documents/${id}`)
  return { success: true, link }
}

// ─── Client: accept the quote → their service agreement is issued ────────────
// Idempotent: a second press (or a second tab) returns the same agreement.
export async function acceptQuoteAction(code: string): Promise<{ agreementCode: string } | { error: string }> {
  const db = createAdminClient() as any
  const { data: quote } = await db.from('proposal_documents')
    .select('id, kind, status, data, signer_email, client_id, lead_id, ref_number')
    .eq('sign_code', code).maybeSingle()
  if (!quote || quote.kind !== 'proposal' || !isTemplateDocData(quote.data) || !quote.data.quoteMode) {
    return { error: "This quote link isn't valid." }
  }

  const existing = await agreementFor(db, quote.id)
  if (existing) return { agreementCode: existing }

  // Claim the acceptance so two presses can't issue two agreements.
  const acceptedAt = new Date().toISOString()
  const { data: claimed } = await db.from('proposal_documents')
    .update({ status: 'accepted', data: { ...quote.data, acceptedAt } })
    .eq('id', quote.id).neq('status', 'accepted').select('id')
  if (!claimed?.length) {
    // Someone else is mid-accept; give their insert a moment to land.
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 400))
      const again = await agreementFor(db, quote.id)
      if (again) return { agreementCode: again }
    }
    return { error: 'Your quote was accepted. Please refresh the page to open your agreement.' }
  }

  const ref = (quote.ref_number || `DC-PROP-${Math.floor(1000 + Math.random() * 8999)}`).replace(/^DC-PROP/, 'DCA')
  const data = { ...agreementFromQuote(quote.data, ref), agreementDate: auDate() }
  const agreementCode = await uniqueSignCode(db, data.clientName)
  const { error } = await db.from('proposal_documents').insert({
    kind: 'agreement',
    status: 'out_for_signature',
    ref_number: ref,
    client_name: data.clientName,
    client_id: quote.client_id,
    lead_id: quote.lead_id,
    source_id: quote.id,
    signer_email: quote.signer_email,
    sign_code: agreementCode,
    sent_at: acceptedAt,
    data,
  })
  if (error) {
    // Let the client try again rather than leaving an accepted quote with no agreement.
    await db.from('proposal_documents').update({ status: 'sent', data: quote.data }).eq('id', quote.id)
    return { error: 'Something went wrong. Please try again.' }
  }

  const link = `${APP_URL}/sign/${agreementCode}`
  if (quote.signer_email) {
    sendEmail(quote.signer_email, 'Your Core Cleaning service agreement — ready to sign', agreementReadyEmail(data.clientName, link)).catch(() => {})
  }
  sendPushToRole('admin', {
    title: `${data.clientName} accepted the quote`,
    body: 'Their service agreement has been sent to sign',
    url: '/documents',
  }).catch(() => {})

  revalidatePath('/documents'); revalidatePath(`/documents/${quote.id}`)
  return { agreementCode }
}

async function agreementFor(db: any, quoteId: string): Promise<string | null> {
  const { data } = await db.from('proposal_documents')
    .select('sign_code').eq('source_id', quoteId).eq('kind', 'agreement')
    .order('created_at', { ascending: true }).limit(1).maybeSingle()
  return data?.sign_code ?? null
}

// ─── Emails ───────────────────────────────────────────────────────────────────

function shell(body: string): string {
  return `<div style="background:#eef1f5;padding:32px 16px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(15,23,42,.10);">
      <div style="background:#00250e;padding:30px 30px 26px;text-align:center;">
        <img src="${WORDMARK}" alt="Core Cleaning" style="height:26px;width:auto;" />
      </div>
      <div style="padding:34px 34px 30px;">${body}</div>
    </div>
    <p style="font-size:11px;color:#94a3b8;margin:18px auto 0;text-align:center;max-width:560px;line-height:1.7;">
      Core Cleaning &middot; ABN 45 344 135 153 &middot; Brisbane QLD
    </p>
  </div>`
}

function button(link: string, label: string): string {
  return `<a href="${link}" style="display:block;text-align:center;background:#00250e;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;border-radius:12px;padding:18px 24px;">${label}</a>
    <p style="text-align:center;font-size:11.5px;color:#cbd5e1;margin:12px 0 0;">Button not working? Paste this: <span style="color:#94a3b8;word-break:break-all;">${link}</span></p>`
}

function quoteEmail(name: string, link: string, message?: string): string {
  const note = (message ?? '').trim()
  return shell(`
    <p style="font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#2563eb;margin:0 0 12px;">Your quote</p>
    <h1 style="font-size:24px;line-height:1.25;margin:0 0 12px;color:#0f172a;font-weight:800;">Hi ${esc(name)}, here&rsquo;s your quote.</h1>
    <p style="font-size:14.5px;line-height:1.65;color:#475569;margin:0 0 ${note ? '18px' : '26px'};">
      Have a look through it. If you&rsquo;re happy, press <strong>Accept quote</strong> and we&rsquo;ll have your service agreement ready to sign straight away.
    </p>
    ${note ? `<div style="background:#f8fafc;border-left:3px solid #2563eb;border-radius:8px;padding:13px 16px;margin:0 0 26px;font-size:14px;color:#334155;line-height:1.55;">${esc(note).replace(/\n/g, '<br/>')}</div>` : ''}
    ${button(link, 'View your quote &rarr;')}`)
}

function agreementReadyEmail(name: string, link: string): string {
  return shell(`
    <p style="font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#2563eb;margin:0 0 12px;">Quote accepted</p>
    <h1 style="font-size:24px;line-height:1.25;margin:0 0 12px;color:#0f172a;font-weight:800;">Thanks ${esc(name)}, your agreement is ready.</h1>
    <p style="font-size:14.5px;line-height:1.65;color:#475569;margin:0 0 26px;">
      We&rsquo;ve filled in your service agreement from your quote. All that&rsquo;s left is to choose your start date and sign. If you&rsquo;ve already done that, you can ignore this email.
    </p>
    ${button(link, 'Choose start date &amp; sign &rarr;')}`)
}
