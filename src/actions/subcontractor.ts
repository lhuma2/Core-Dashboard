'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'
import { sendPushToRole } from '@/lib/push'

const APP_URL = 'https://portal.deltacleaning.com.au'
const OWNER_EMAIL = 'hello@deltacleaning.com.au'
const CODE_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz'

export interface SubbieDetails {
  companyName?: string
  abn?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  insuranceExpiry?: string
}

function makeCode(): string {
  let r = ''
  for (let i = 0; i < 8; i++) r += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  return `subcontractor-${r}`
}

// Get-or-create the single subcontractor onboarding record + a copyable link.
export async function ensureSubcontractorLinkAction(): Promise<{ code: string; link: string } | { error: string }> {
  const db = createAdminClient() as any
  const { data: existing } = await db.from('subcontractors')
    .select('id, sign_code').order('created_at', { ascending: false }).limit(1).maybeSingle()

  let code: string | null = existing?.sign_code ?? null
  if (existing?.id && !code) {
    code = makeCode()
    await db.from('subcontractors').update({ sign_code: code }).eq('id', existing.id)
  } else if (!existing) {
    code = makeCode()
    const { error } = await db.from('subcontractors').insert({ sign_code: code })
    if (error) return { error: error.message }
  }
  revalidatePath('/safety')
  return { code: code!, link: `${APP_URL}/onboard/${code}` }
}

// The subcontractor submits their details + signs the whole pack (once).
export async function submitSubcontractorOnboardingAction(code: string, typedName: string, details: SubbieDetails) {
  const name = (typedName ?? '').trim().replace(/\s+/g, ' ')
  if (name.length < 2) return { error: 'Please type your full name to sign.' }

  const db = createAdminClient() as any
  const { data: sub } = await db.from('subcontractors').select('id, signed_at').eq('sign_code', code).maybeSingle()
  if (!sub) return { error: 'This onboarding link is not valid.' }
  if (sub.signed_at) return { success: true, alreadySigned: true }

  const clean = (v?: string) => (v ?? '').trim() || null
  const h = headers()
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || null
  const now = new Date().toISOString()

  const { error } = await db.from('subcontractors').update({
    company_name: clean(details.companyName),
    abn: clean(details.abn),
    contact_name: clean(details.contactName),
    contact_email: clean(details.contactEmail),
    contact_phone: clean(details.contactPhone),
    insurance_expiry: clean(details.insuranceExpiry),
    signed_name: name, signed_at: now, signed_ip: ip, updated_at: now,
  }).eq('id', sub.id)
  if (error) return { error: error.message }

  const co = clean(details.companyName) || 'Your subcontractor'
  const when = new Date(now).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Brisbane' })
  sendPushToRole('admin', { title: `${co} signed the onboarding pack`, body: name, url: '/safety' }).catch(() => {})
  sendEmail(OWNER_EMAIL, `Subcontractor onboarded — ${co}`,
    `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a;"><p><strong>${co}</strong> has signed the onboarding pack (agreement, induction, SWMS & policies).</p><p>Signed by ${name} on ${when}.</p></div>`
  ).catch(() => {})

  revalidatePath('/safety'); revalidatePath(`/onboard/${code}`)
  return { success: true, date: when }
}
