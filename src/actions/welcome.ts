'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'
import { requireStaff } from '@/lib/require-staff'
import { createPortalUserAction } from '@/actions/team'
import { linkOrCreateClient, portalLoginFor } from '@/lib/documents/agreement-client'
import { clientTypeOf } from '@/lib/documents/quote'
import { APP_URL, WORDMARK, EMAIL_RE, esc, uniqueSignCode } from '@/lib/documents/sign-code'

// ─── Client portal login (chosen by the owner on the client profile) ─────────
export async function saveClientPortalLoginAction(clientId: string, input: { email: string; fullName: string; password: string }) {
  const denied = await requireStaff()
  if (denied) return { error: denied }
  const email = (input.email ?? '').trim().toLowerCase()
  const fullName = (input.fullName ?? '').trim()
  const password = input.password ?? ''
  if (!EMAIL_RE.test(email)) return { error: 'Enter a valid login email.' }
  if (!fullName) return { error: 'Enter the contact name.' }
  if (password.length < 6) return { error: 'The password needs at least 6 characters.' }

  const db = createAdminClient() as any
  const { data: client } = await db.from('clients').select('id').eq('id', clientId).maybeSingle()
  if (!client) return { error: 'Client not found.' }

  // Setting a login on an email that's already in use takes over that account,
  // so never touch a staff login or another client's login.
  const { data: taken } = await db.from('profiles')
    .select('role, linked_client_id').ilike('email', email.replace(/[\\%_]/g, (c) => '\\' + c))
  if ((taken ?? []).some((p: any) => p.role !== 'client')) {
    return { error: 'That email is already a staff login. Use the client’s own email.' }
  }
  if ((taken ?? []).some((p: any) => p.linked_client_id && p.linked_client_id !== clientId)) {
    return { error: 'That email is already the portal login for another client.' }
  }
  const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 })
  const authUser = (list?.users ?? []).find((u: any) => (u.email ?? '').toLowerCase() === email)
  if (authUser && ((authUser.user_metadata?.role as string) ?? 'admin') !== 'client') {
    return { error: 'That email is already a staff login. Use the client’s own email.' }
  }

  const res = await createPortalUserAction({ email, password, fullName, role: 'client', linkedClientId: clientId })
  if ((res as any)?.error) return { error: (res as any).error as string }

  await db.from('clients').update({ needs_review: false }).eq('id', clientId)
  revalidatePath(`/clients/${clientId}`); revalidatePath('/clients')
  return { success: true }
}

// ─── Welcome page (commercial clients only) ──────────────────────────────────
export async function sendWelcomeAction(clientId: string, password?: string) {
  const denied = await requireStaff()
  if (denied) return { error: denied }
  const db = createAdminClient() as any
  const { data: client } = await db.from('clients')
    .select('id, business_name, contact_name, welcome_code').eq('id', clientId).maybeSingle()
  if (!client) return { error: 'Client not found.' }

  // Residential and end-of-lease clients never get the welcome page.
  const { data: agreements } = await db.from('proposal_documents')
    .select('data').eq('client_id', clientId).eq('kind', 'agreement')
  if ((agreements ?? []).some((a: any) => clientTypeOf(a.data) !== 'commercial')) {
    return { error: 'The welcome page is only for commercial clients.' }
  }

  const login = await portalLoginFor(db, clientId)
  if (!login?.email) return { error: 'Set their portal login first.' }

  const code: string = client.welcome_code ?? await uniqueSignCode(db, client.business_name, 'clients', 'welcome_code')
  const { error } = await db.from('clients')
    .update({ welcome_code: code, welcome_sent_at: new Date().toISOString(), needs_review: false })
    .eq('id', clientId)
  if (error) return { error: error.message }

  const link = `${APP_URL}/welcome/${code}`
  const res = await sendEmail(login.email, `Welcome to Core Cleaning, ${client.business_name}`,
    welcomeEmail(login.name || client.contact_name || client.business_name, link, login.email, (password ?? '').trim() || null))
  if (!res.success) return { error: res.error ?? 'Could not send the email. Please try again.' }

  revalidatePath(`/clients/${clientId}`); revalidatePath('/clients')
  return { success: true, link }
}

// ─── Clients-tab prompts for signed agreements ───────────────────────────────
export async function markClientReviewedAction(clientId: string) {
  const denied = await requireStaff()
  if (denied) return { error: denied }
  const db = createAdminClient() as any
  await db.from('clients').update({ needs_review: false }).eq('id', clientId)
  revalidatePath('/clients'); revalidatePath(`/clients/${clientId}`)
  return { success: true }
}

// A signed commercial agreement with no client (automatic creation didn't run).
export async function createClientFromAgreementAction(docId: string) {
  const denied = await requireStaff()
  if (denied) return { error: denied }
  const db = createAdminClient() as any
  const { data: doc } = await db.from('proposal_documents')
    .select('id, client_id, signer_email, signed_name, data, onboarding, status, kind')
    .eq('id', docId).maybeSingle()
  if (!doc || doc.kind !== 'agreement' || doc.status !== 'signed') return { error: 'Signed agreement not found.' }
  const res = await linkOrCreateClient(db, doc)
  if (!res.clientId) return { error: res.error ?? 'Could not create the client.' }
  revalidatePath('/clients'); revalidatePath('/documents')
  redirect(`/clients/${res.clientId}`)
}

export async function dismissAgreementPromptAction(docId: string) {
  const denied = await requireStaff()
  if (denied) return { error: denied }
  const db = createAdminClient() as any
  const { error } = await db.from('proposal_documents').update({ client_added_at: new Date().toISOString() }).eq('id', docId)
  if (error) return { error: error.message }
  revalidatePath('/clients')
  return { success: true }
}

// ─── Email ────────────────────────────────────────────────────────────────────
function welcomeEmail(name: string, link: string, loginEmail: string, password: string | null): string {
  const first = (name || '').trim().split(' ')[0] || 'there'
  return `<div style="background:#eef1f5;padding:32px 16px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(15,23,42,.10);">
      <div style="background:#00250e;padding:30px 30px 26px;text-align:center;">
        <img src="${WORDMARK}" alt="Core Cleaning" style="height:26px;width:auto;" />
      </div>
      <div style="padding:34px 34px 30px;">
        <p style="font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#2563eb;margin:0 0 12px;">Welcome aboard</p>
        <h1 style="font-size:24px;line-height:1.25;margin:0 0 12px;color:#0f172a;font-weight:800;">Hi ${esc(first)}, welcome to Core Cleaning.</h1>
        <p style="font-size:14.5px;line-height:1.65;color:#475569;margin:0 0 22px;">
          Your client portal is set up. Your welcome page has everything you need to get started, including how to log in.
        </p>
        <div style="border:1px solid #eef2f6;border-radius:14px;padding:14px 18px;margin:0 0 24px;font-size:13.5px;color:#334155;">
          <p style="margin:0 0 6px;"><span style="color:#94a3b8;">Login email</span>&nbsp; <strong>${esc(loginEmail)}</strong></p>
          ${password ? `<p style="margin:0;"><span style="color:#94a3b8;">Password</span>&nbsp; <strong>${esc(password)}</strong></p>` : ''}
        </div>
        <a href="${link}" style="display:block;text-align:center;background:#00250e;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;border-radius:12px;padding:18px 24px;">Open your welcome page &rarr;</a>
        <p style="text-align:center;font-size:11.5px;color:#cbd5e1;margin:12px 0 0;">Button not working? Paste this: <span style="color:#94a3b8;word-break:break-all;">${link}</span></p>
      </div>
    </div>
    <p style="font-size:11px;color:#94a3b8;margin:18px auto 0;text-align:center;max-width:560px;line-height:1.7;">Core Cleaning &middot; Brisbane QLD &middot; admin@corecleaning.services</p>
  </div>`
}
