'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'
import { sendPushToRole } from '@/lib/push'
import { withAgreementDefaults, type AgreementData } from '@/lib/documents/agreement'
import { linkOrCreateClient } from '@/lib/documents/agreement-client'
import { CLIENT_TYPE_LABELS, clientTypeOf, type ClientType } from '@/lib/documents/quote'
import { APP_URL, OWNER_EMAIL, WORDMARK, EMAIL_RE, auDate, uniqueSignCode } from '@/lib/documents/sign-code'

// ─── Issue the agreement for signature: mint a unique link + email the client ──
export async function sendForSignatureAction(id: string, toEmail: string, message?: string) {
  const email = (toEmail ?? '').trim()
  if (!EMAIL_RE.test(email)) return { error: 'Enter a valid email address.' }

  const db = createAdminClient() as any
  const { data: doc } = await db
    .from('proposal_documents')
    .select('id, kind, sign_code, data')
    .eq('id', id).single()
  if (!doc) return { error: 'Document not found.' }
  if (doc.kind !== 'agreement') return { error: 'Only service agreements can be sent for signature.' }

  const agreement = withAgreementDefaults(doc.data)
  // Reuse an existing code so a re-send keeps the same link.
  const code: string = doc.sign_code ?? await uniqueSignCode(db, agreement.clientName)

  const { error } = await db.from('proposal_documents').update({
    sign_code:    code,
    signer_email: email,
    status:       'out_for_signature',
    sent_at:      new Date().toISOString(),
    // The agreement is dated the day it's issued.
    data:         { ...(doc.data ?? {}), agreementDate: auDate() },
  }).eq('id', id)
  if (error) return { error: error.message }

  const link = `${APP_URL}/sign/${code}`
  const res = await sendEmail(
    email,
    `Your Core Cleaning service agreement — ready to sign`,
    inviteEmail(agreement, link, message),
  )
  if (!res.success) return { error: res.error ?? 'Could not send the email. Please try again.' }

  revalidatePath('/documents'); revalidatePath(`/documents/${id}`)
  return { success: true, link }
}

// ─── Company-document proposals: send the PDF (with placed fields) for signing ─
export async function sendCompanyDocForSignatureAction(id: string, toEmail: string, message?: string) {
  const email = (toEmail ?? '').trim()
  if (!EMAIL_RE.test(email)) return { error: 'Enter a valid email address.' }

  const db = createAdminClient() as any
  const { data: doc } = await db
    .from('proposal_documents')
    .select('id, sign_code, data, client_name, pdf_url')
    .eq('id', id).single()
  if (!doc) return { error: 'Document not found.' }
  if (!doc.pdf_url) return { error: 'Only company documents can be sent this way.' }

  const name = doc.data?.fieldValues?.clientName || doc.client_name || 'Client'
  const code: string = doc.sign_code ?? await uniqueSignCode(db, name)

  const { error } = await db.from('proposal_documents').update({
    sign_code: code, signer_email: email, status: 'out_for_signature', sent_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) return { error: error.message }

  const link = `${APP_URL}/sign/${code}`
  const res = await sendEmail(email, 'Please review & sign — Core Cleaning', companyDocInviteEmail(doc.client_name || 'your document', link, message))
  if (!res.success) return { error: res.error ?? 'Could not send the email. Please try again.' }

  revalidatePath('/documents'); revalidatePath(`/documents/${id}`)
  return { success: true, link }
}

// Recipient completes & signs the company document (fills signature field(s)).
export async function submitCompanyDocSignatureAction(code: string, placements: any[]) {
  const db = createAdminClient() as any
  const { data: doc } = await db
    .from('proposal_documents')
    .select('id, data, pdf_url, signed_at')
    .eq('sign_code', code).maybeSingle()
  if (!doc || !doc.pdf_url) return { error: "This signing link isn't valid." }
  if (doc.signed_at) return { error: 'This document has already been signed.' }

  const sig = (placements || []).find((p: any) => p.type === 'signature' && String(p.text ?? '').trim())
  if (!sig) return { error: 'Please add your signature before submitting.' }

  const ip = headers().get('x-forwarded-for')?.split(',')[0]?.trim() || null
  const { error } = await db.from('proposal_documents').update({
    data: { ...(doc.data ?? {}), placements },
    signed_name: String(sig.text).trim(),
    signed_at: new Date().toISOString(),
    signed_ip: ip,
    status: 'signed',
  }).eq('id', doc.id)
  if (error) return { error: error.message }

  // Notify the owner by push.
  try { await sendPushToRole('admin', { title: '✍️ A document was signed', body: `Signed by ${String(sig.text).trim()}`, url: '/documents' }) } catch {}
  return { success: true }
}

// Recipient signs a document made from a company-document template.
export async function submitTemplateDocSignatureAction(code: string, signatures: Record<string, string>, signedName: string) {
  const db = createAdminClient() as any
  const { data: doc } = await db
    .from('proposal_documents')
    .select('id, data, pdf_url, signed_at')
    .eq('sign_code', code).maybeSingle()
  if (!doc || !doc.pdf_url || !Array.isArray(doc.data?.template?.fields)) return { error: "This signing link isn't valid." }
  if (doc.signed_at) return { error: 'This document has already been signed.' }

  const name = String(signedName ?? '').trim().slice(0, 120)
  if (name.length < 2) return { error: 'Please type your signature before submitting.' }
  // Keep only signatures for the template's own signature spots.
  const sigIds = new Set(doc.data.template.fields.filter((f: any) => f.kind === 'signature').map((f: any) => f.id))
  const clean: Record<string, string> = {}
  for (const [k, v] of Object.entries(signatures ?? {})) {
    if (sigIds.has(k) && String(v).trim()) clean[k] = String(v).trim().slice(0, 120)
  }
  if (sigIds.size && Object.keys(clean).length < sigIds.size) return { error: 'Please sign in every highlighted box.' }

  const ip = headers().get('x-forwarded-for')?.split(',')[0]?.trim() || null
  const { error } = await db.from('proposal_documents').update({
    data: { ...doc.data, signatures: clean },
    signed_name: name,
    signed_at: new Date().toISOString(),
    signed_ip: ip,
    status: 'signed',
  }).eq('id', doc.id)
  if (error) return { error: error.message }

  try { await sendPushToRole('admin', { title: '✍️ A document was signed', body: `Signed by ${name}`, url: '/documents' }) } catch {}
  return { success: true }
}

function companyDocInviteEmail(title: string, link: string, message?: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#0f172a">
    <div style="background:#00250e;padding:26px 30px;text-align:center;border-radius:12px 12px 0 0">
      <img src="${WORDMARK}" alt="Core Cleaning" style="height:34px" />
    </div>
    <div style="border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px;padding:28px 30px">
      <p style="font-size:15px;margin:0 0 14px">Hi,</p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 16px">You've been sent a document from Core Cleaning to review and sign.</p>
      ${message ? `<p style="font-size:14px;line-height:1.6;color:#475569;margin:0 0 16px">${message}</p>` : ''}
      <a href="${link}" style="display:block;text-align:center;background:#00250e;color:#fff;text-decoration:none;font-size:16px;font-weight:700;border-radius:12px;padding:16px 24px;margin:6px 0 18px">Review &amp; sign &rarr;</a>
      <p style="font-size:12px;color:#94a3b8;margin:0">If the button doesn't work, copy this link: ${link}</p>
    </div>
    <p style="text-align:center;font-size:12px;color:#94a3b8;margin:16px 0">Core Cleaning · Brisbane, QLD · admin@corecleaning.services</p>
  </div>`
}

// ─── Client submits their signature (+ optional onboarding details) ────────────
export interface SignerDetails {
  abn?: string
  billingEmail?: string
  poNumber?: string
  siteContactName?: string
  siteContactPhone?: string
  notes?: string
}

export async function submitSignatureAction(code: string, typedName: string, details?: SignerDetails, startDate?: string) {
  const name = (typedName ?? '').trim().replace(/\s+/g, ' ')
  if (name.length < 2) return { error: 'Please type your full name to sign.' }

  const clean = (v?: string) => (v ?? '').trim() || null
  const d = {
    abn: clean(details?.abn), billingEmail: clean(details?.billingEmail), poNumber: clean(details?.poNumber),
    siteContactName: clean(details?.siteContactName), siteContactPhone: clean(details?.siteContactPhone),
    notes: clean(details?.notes),
  }

  const db = createAdminClient() as any
  const { data: doc } = await db
    .from('proposal_documents')
    .select('id, status, signed_at, data, client_id, signer_email')
    .eq('sign_code', code).maybeSingle()
  if (!doc) return { error: 'This signing link is not valid.' }
  if (doc.signed_at) return { success: true, alreadySigned: true, date: auDate(doc.signed_at) }

  // Agreements issued from an accepted quote: the client picks their start date.
  let newData: any = { ...(doc.data ?? {}) }
  if (newData.clientPicksStartDate) {
    const iso = (startDate ?? '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return { error: 'Please choose your start date.' }
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' })
    if (iso < today) return { error: 'Your start date can’t be in the past.' }
    newData.commencementDate = auDate(iso + 'T12:00:00+10:00')
    newData.commencementDateIso = iso
  }
  // The ABN the client typed goes onto the contract itself.
  if (d.abn) newData.clientABN = d.abn

  const h = headers()
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || null
  const signedAt = new Date().toISOString()

  const { data: updated, error } = await db.from('proposal_documents').update({
    signed_name: name, signed_at: signedAt, signed_ip: ip, status: 'signed',
    onboarding: d, data: newData,
  }).eq('id', doc.id).is('signed_at', null).select('id')
  if (error) return { error: error.message }
  if (!updated?.length) return { success: true, alreadySigned: true, date: auDate(signedAt) }

  const agreement = withAgreementDefaults(newData)
  const clientType = clientTypeOf(newData)

  // Onboarding-on-sign. Commercial: link to an existing client of the same name,
  // or create the profile from the agreement and flag it for review on the Clients
  // tab. Residential / end of lease live in their own tables, so those are only
  // prompted on the Clients tab (prefilled) rather than created here.
  let clientId: string | null = doc.client_id
  let createdNewClient = false
  if (!clientId && clientType === 'commercial') {
    const res = await linkOrCreateClient(db, { ...doc, signed_name: name, data: newData, onboarding: d })
    clientId = res.clientId
    createdNewClient = res.created
  }

  // Notify the owner — push + email (best-effort; never block the signer on these).
  const ownerUrl = clientId ? `/clients/${clientId}` : clientType === 'commercial' ? `/documents/${doc.id}` : '/clients'
  sendPushToRole('admin', {
    title: `${agreement.clientName} signed the agreement`,
    body:  createdNewClient ? 'New client profile created — review it'
      : clientType !== 'commercial' ? `${CLIENT_TYPE_LABELS[clientType]} — add them on the Clients tab`
      : `${name} · ${agreement.serviceFee}`,
    url:   ownerUrl,
  }).catch(() => {})
  sendEmail(OWNER_EMAIL, `Signed — ${agreement.clientName}`, signedOwnerEmail(agreement, name, signedAt, doc.id, createdNewClient ? clientId : null, clientType)).catch(() => {})

  revalidatePath('/documents'); revalidatePath(`/documents/${doc.id}`); revalidatePath('/clients')
  if (clientId) revalidatePath(`/clients/${clientId}`)
  return { success: true, date: auDate(signedAt) }
}

// ─── Onboarding: the client submits a few details AFTER signing ────────────────
// The ABN is stamped onto the (already-signed) contract, and all details fill the
// linked client's empty fields (never clobbering what's already there).
export async function submitOnboardingAction(code: string, details: SignerDetails) {
  const db = createAdminClient() as any
  const { data: doc } = await db.from('proposal_documents')
    .select('id, data, client_id').eq('sign_code', code).maybeSingle()
  if (!doc) return { error: 'This link is not valid.' }

  const clean = (v?: string) => (v ?? '').trim() || null
  const d = {
    abn: clean(details.abn), billingEmail: clean(details.billingEmail), poNumber: clean(details.poNumber),
    siteContactName: clean(details.siteContactName), siteContactPhone: clean(details.siteContactPhone), notes: clean(details.notes),
  }
  const newData = d.abn ? { ...(doc.data ?? {}), clientABN: d.abn } : doc.data
  await db.from('proposal_documents').update({ onboarding: d, data: newData }).eq('id', doc.id)

  if (doc.client_id) {
    const { data: c } = await db.from('clients')
      .select('abn, billing_email, po_number, site_contact_name, site_contact_phone, notes')
      .eq('id', doc.client_id).maybeSingle()
    if (c) {
      await db.from('clients').update({
        abn:                c.abn                ?? d.abn,
        billing_email:      c.billing_email      ?? d.billingEmail,
        po_number:          c.po_number          ?? d.poNumber,
        site_contact_name:  c.site_contact_name  ?? d.siteContactName,
        site_contact_phone: c.site_contact_phone ?? d.siteContactPhone,
        notes:              c.notes              ?? d.notes,
      }).eq('id', doc.client_id)
    }
    revalidatePath(`/clients/${doc.client_id}`)
  }
  revalidatePath('/documents'); revalidatePath(`/documents/${doc.id}`)
  return { success: true }
}

// ─── Ensure a signing link exists (backs the editor's "Copy signing link") ─────
// Idempotent: mints a sign_code once so the /sign/<code> link is ready to copy,
// without emailing or changing the document's status.
export async function ensureSignCode(id: string): Promise<string | null> {
  const db = createAdminClient() as any
  const { data: doc } = await db
    .from('proposal_documents')
    .select('id, kind, sign_code, data')
    .eq('id', id).maybeSingle()
  if (!doc || doc.kind !== 'agreement') return null
  if (doc.sign_code) return doc.sign_code
  const agreement = withAgreementDefaults(doc.data)
  const code = await uniqueSignCode(db, agreement.clientName)
  await db.from('proposal_documents').update({ sign_code: code }).eq('id', id)
  return code
}

// Stamp the agreement with today's date when it's issued via the copy-link path.
export async function stampIssueDateAction(id: string): Promise<{ date: string } | { error: string }> {
  const db = createAdminClient() as any
  const { data: doc } = await db.from('proposal_documents').select('data, status').eq('id', id).maybeSingle()
  if (!doc) return { error: 'Document not found.' }
  const date = auDate()
  const patch: any = { data: { ...(doc.data ?? {}), agreementDate: date } }
  if (doc.status === 'draft') patch.status = 'out_for_signature'
  await db.from('proposal_documents').update(patch).eq('id', id)
  revalidatePath('/documents'); revalidatePath(`/documents/${id}`)
  return { date }
}

// ─── Email templates ───────────────────────────────────────────────────────────

function inviteEmail(a: AgreementData, link: string, message?: string): string {
  const note = (message ?? '').trim()
  const first = a.clientName?.trim() || 'there'
  const row = (label: string, value?: string) =>
    value && value.trim()
      ? `<tr>
          <td style="padding:12px 0;color:#94a3b8;font-size:13px;border-top:1px solid #f1f5f9;">${label}</td>
          <td style="padding:12px 0;text-align:right;font-weight:600;color:#0f172a;font-size:13px;border-top:1px solid #f1f5f9;">${value}</td>
        </tr>`
      : ''
  const summary = [row('Site', a.premises), row('Frequency', a.frequency), row('Service fee', a.serviceFee)].join('')
  return `
  <div style="background:#eef1f5;padding:32px 16px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(15,23,42,.10);">
      <div style="background:#00250e;padding:30px 30px 26px;text-align:center;">
        <img src="${WORDMARK}" alt="Core Cleaning" style="height:26px;width:auto;" />
      </div>
      <div style="height:4px;background:linear-gradient(90deg,#2563eb,#60a5fa);line-height:4px;font-size:0;">&nbsp;</div>
      <div style="padding:34px 34px 30px;">
        <p style="font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#2563eb;margin:0 0 12px;">Service Agreement${a.agreementRef ? ` &middot; ${a.agreementRef}` : ''}</p>
        <h1 style="font-size:25px;line-height:1.22;margin:0 0 12px;color:#0f172a;font-weight:800;letter-spacing:-.01em;">Hi ${first}, you&rsquo;re ready to sign.</h1>
        <p style="font-size:14.5px;line-height:1.65;color:#475569;margin:0 0 ${note ? '18px' : '26px'};">
          We&rsquo;ve prepared your cleaning service agreement. Give it a read, and when you&rsquo;re happy, sign securely online &mdash; it takes about a minute, with no account or app to download.
        </p>
        ${note ? `<div style="background:#f8fafc;border-left:3px solid #2563eb;border-radius:8px;padding:13px 16px;margin:0 0 26px;font-size:14px;color:#334155;line-height:1.55;">${note.replace(/</g, '&lt;').replace(/\n/g, '<br/>')}</div>` : ''}
        ${summary ? `<div style="border:1px solid #eef2f6;border-radius:14px;padding:2px 18px 10px;margin:0 0 28px;">
          <p style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#94a3b8;margin:16px 0 2px;">Summary</p>
          <table style="width:100%;border-collapse:collapse;">${summary}</table>
        </div>` : ''}
        <a href="${link}" style="display:block;text-align:center;background:#00250e;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;border-radius:12px;padding:18px 24px;">Review &amp; sign &rarr;</a>
        <p style="text-align:center;font-size:12px;color:#94a3b8;margin:14px 0 0;">&#128274;&nbsp; Secure &middot; unique to you &middot; no account needed</p>
        <p style="text-align:center;font-size:11.5px;color:#cbd5e1;margin:10px 0 0;">Button not working? Paste this: <span style="color:#94a3b8;word-break:break-all;">${link}</span></p>
        <div style="border-top:1px solid #f1f5f9;margin-top:28px;padding-top:22px;">
          <p style="font-size:13.5px;color:#475569;margin:0 0 6px;line-height:1.5;">Questions before you sign? Reply to this email, or reach ${a.contactName} directly:</p>
          <p style="font-size:13.5px;color:#0f172a;font-weight:600;margin:0;">${a.contactPhone} &nbsp;&middot;&nbsp; ${a.contactEmail}</p>
        </div>
      </div>
    </div>
    <p style="font-size:11px;color:#94a3b8;margin:18px auto 0;text-align:center;max-width:560px;line-height:1.7;">
      Core Cleaning &middot; ABN 45 344 135 153 &middot; Brisbane QLD<br/>
      This signing link is unique to you &mdash; please don&rsquo;t forward it.
    </p>
  </div>`
}

function signedOwnerEmail(a: AgreementData, name: string, signedAtIso: string, docId: string, newClientId?: string | null, clientType: ClientType = 'commercial'): string {
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px 18px;color:#0f172a;">
    <div style="background:#00250e;border-radius:12px 12px 0 0;padding:22px 26px;">
      <p style="margin:0;color:#86efac;font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;">Core Cleaning · Signed</p>
      <h1 style="margin:6px 0 0;color:#fff;font-size:20px;">${a.clientName} signed the agreement</h1>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:26px;">
      <table style="width:100%;font-size:13.5px;color:#334155;border-collapse:collapse;">
        <tr><td style="padding:6px 0;color:#94a3b8;">Signed by</td><td style="padding:6px 0;text-align:right;font-weight:600;">${name}</td></tr>
        <tr><td style="padding:6px 0;color:#94a3b8;">When</td><td style="padding:6px 0;text-align:right;font-weight:600;">${auDate(signedAtIso)}</td></tr>
        <tr><td style="padding:6px 0;color:#94a3b8;">Service fee</td><td style="padding:6px 0;text-align:right;font-weight:600;">${a.serviceFee}</td></tr>
        <tr><td style="padding:6px 0;color:#94a3b8;">Site</td><td style="padding:6px 0;text-align:right;font-weight:600;">${a.premises}</td></tr>
        ${a.commencementDate ? `<tr><td style="padding:6px 0;color:#94a3b8;">Start date</td><td style="padding:6px 0;text-align:right;font-weight:600;">${a.commencementDate}</td></tr>` : ''}
      </table>
      ${clientType !== 'commercial' ? `<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:12px 16px;margin-top:18px;font-size:13px;color:#1e40af;line-height:1.5;">
        <strong>${CLIENT_TYPE_LABELS[clientType]} client.</strong> They're waiting on your Clients tab — add them there with the details prefilled.
      </div>
      <a href="${APP_URL}/clients" style="display:inline-block;margin-top:14px;background:#00250e;color:#fff;text-decoration:none;font-size:14px;font-weight:700;border-radius:10px;padding:12px 22px;">Open Clients →</a>` : ''}
      ${clientType !== 'commercial' ? '' : newClientId ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px 16px;margin-top:18px;font-size:13px;color:#166534;line-height:1.5;">
        <strong>New client profile created</strong> from this agreement. A few fields (cleaner cost, exact schedule, scope) need finishing. Open the profile to complete it, then set their portal login and send the welcome page.
      </div>
      <a href="${APP_URL}/clients/${newClientId}" style="display:inline-block;margin-top:14px;background:#00250e;color:#fff;text-decoration:none;font-size:14px;font-weight:700;border-radius:10px;padding:12px 22px;">Open the client profile →</a>`
      : `<a href="${APP_URL}/documents/${docId}" style="display:inline-block;margin-top:18px;background:#00250e;color:#fff;text-decoration:none;font-size:14px;font-weight:700;border-radius:10px;padding:12px 22px;">View the signed agreement →</a>`}
    </div>
  </div>`
}
