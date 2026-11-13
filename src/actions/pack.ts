'use server'

// The public signing page for the subcontractor pack (/pack/<link>). The cleaner isn't logged in: the private link
// is the key. Signing makes their cleaner login and emails it to them, and tells Laith. Words from the mock-up.

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'
import { sendPushToRole } from '@/lib/push'
import { brisbaneToday } from '@/lib/hub/figures'
import { abnFmt, starterPw } from '@/lib/hub/team'

const BUCKET = 'clean-photos'
const TOKEN = /^[0-9a-f]{64}$/
const OFFLINE = 'That didn’t go through. Check your connection and try again.'
const GONE = 'This link isn’t valid any more. Call Laith on 0407 026 360 for a new one.'
const esc = (v: string) => v.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const tidy = (v: unknown) => String(v ?? '').trim().replace(/\s+/g, ' ')
const CERT_EXT: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/heic': 'heic', 'image/heif': 'heic', 'image/webp': 'webp' }

async function packFor(token: string) {
  if (!TOKEN.test(token || '')) return { error: GONE }
  const db = createAdminClient() as any
  const { data: k, error } = await db.from('cleaner_packs').select('id, first_name, last_name, email, phone, region, is_team_leader, signed_at, profile_id').eq('token', token).maybeSingle()
  if (error) return { error: OFFLINE }
  if (!k) return { error: GONE }
  return { db, k: k as any }
}

/** A one-off upload link for their certificate of currency (PDF or photo, up to 10 MB). */
export async function packCertUpload(token: string, type: string, size: number): Promise<{ ok: true; url: string; path: string } | { ok: false; error: string }> {
  const o = await packFor(token); if ('error' in o) return { ok: false, error: o.error! }
  if (o.k.signed_at) return { ok: false, error: 'You’ve already signed. Thank you.' }
  const ext = CERT_EXT[String(type || '').toLowerCase()]
  if (!ext) return { ok: false, error: 'Choose a PDF or a photo of your certificate.' }
  if (!(size > 0) || size > 10 * 1024 * 1024) return { ok: false, error: 'That file is too big. Choose one under 10 MB.' }
  const path = `packs/${o.k.id}/certificate-${Date.now()}.${ext}`
  const s = await o.db.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: true })
  if (s.error || !s.data?.signedUrl) return { ok: false, error: OFFLINE }
  return { ok: true, url: s.data.signedUrl, path }
}

export interface PackForm { company: string; abn: string; contact: string; phone: string; insurer: string; policy: string; expiry: string; cert: string; sig: string; agree: boolean }

function loginEmail(first: string, email: string, pw: string, site: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px 16px;color:#13201a">
  <div style="background:#00250e;color:#fff;padding:18px 20px;border-radius:10px 10px 0 0;font-size:18px;font-weight:700">Core Cleaning</div>
  <div style="border:1px solid #d5dfda;border-top:0;border-radius:0 0 10px 10px;padding:22px 20px;font-size:15px;line-height:1.5">
    <p style="margin:0 0 12px">Hi ${esc(first)},</p>
    <p style="margin:0 0 12px">Thanks for signing the Core Cleaning subcontractor pack. You can now log in to the cleaner portal to see your jobs, checklists and site access details.</p>
    <p style="margin:0 0 12px;background:#f3f5f4;border-radius:8px;padding:10px 12px;font-family:Menlo,monospace;font-size:14px">Website: ${esc(site.replace(/^https?:\/\//, ''))}/cleaner/login<br>Username: ${esc(email)}<br>Password: ${esc(pw)}</p>
    <p style="margin:0 0 12px">The first time you log in it will ask you to choose your own password. On iPhone, open the portal in Safari, tap Share, then Add to Home Screen so it works like an app.</p>
    <p style="margin:0">Kind regards,<br><strong>Laith Humadi</strong><br>Core Cleaning · 0407 026 360 · admin@corecleaning.services</p>
  </div></div>`
}

export async function signPack(token: string, f: PackForm): Promise<{ ok: true; name: string; email: string; tested: boolean; pw?: string } | { ok: false; error: string }> {
  const o = await packFor(token); if ('error' in o) return { ok: false, error: o.error! }
  const { db, k } = o
  const name = `${k.first_name} ${k.last_name}`.trim()
  if (k.signed_at) return { ok: true, name, email: k.email, tested: false }
  const abn = String(f.abn || '').replace(/[^0-9]/g, '')
  const company = tidy(f.company), insurer = tidy(f.insurer), policy = tidy(f.policy), sig = tidy(f.sig), contact = tidy(f.contact), phone = tidy(f.phone)
  const expiry = String(f.expiry || '')
  const miss: string[] = []
  if (!company) miss.push('company or trading name')
  if (abn.length !== 11) miss.push('an 11 digit ABN')
  if (!insurer) miss.push('insurer')
  if (!policy) miss.push('policy number')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry)) miss.push('insurance expiry date')
  if (sig.length < 2) miss.push('your typed name to sign')
  if (miss.length) return { ok: false, error: 'Please add ' + miss.join(', ') + '.' }
  if (expiry < brisbaneToday()) return { ok: false, error: 'That insurance has already expired. Renew it before signing.' }
  if (!f.agree) return { ok: false, error: 'Tick the box to agree to the pack.' }
  if (phone && phone.replace(/[^0-9]/g, '').length !== 10) return { ok: false, error: 'Mobile numbers have 10 digits, e.g. 0412 345 678.' }
  if ([company, insurer, policy, sig, contact].some(v => v.length > 200)) return { ok: false, error: 'One of those answers is too long.' }
  const cert = f.cert && f.cert.startsWith(`packs/${k.id}/`) && !f.cert.includes('..') ? f.cert : null

  // Their cleaner login. The starter password is their first name (see starterPw).
  const yr = +brisbaneToday().slice(0, 4)
  let pw = starterPw(k.first_name, yr)
  let made = await db.auth.admin.createUser({ email: k.email, password: pw, email_confirm: true, user_metadata: { role: 'cleaner', full_name: name } })
  if (made.error && /password/i.test(made.error.message || '') && pw === k.first_name) {
    pw = k.first_name + yr
    made = await db.auth.admin.createUser({ email: k.email, password: pw, email_confirm: true, user_metadata: { role: 'cleaner', full_name: name } })
  }
  if (made.error || !made.data?.user) {
    if (/already|registered|exists/i.test(made.error?.message || '')) return { ok: false, error: 'That email already has a Core Cleaning login. Call Laith on 0407 026 360 to sort it out.' }
    return { ok: false, error: OFFLINE }
  }
  const userId = made.data.user.id
  const now = new Date().toISOString()
  const { data: prof, error: pErr } = await db.from('profiles').insert({
    user_id: userId, role: 'cleaner', full_name: name, email: k.email, phone: k.phone || phone || null, region: k.region, is_team_leader: !!k.is_team_leader, pack_signed_at: now,
  }).select('id').single()
  if (pErr || !prof) { await db.auth.admin.deleteUser(userId).catch(() => {}); return { ok: false, error: OFFLINE } }
  const ip = (headers().get('x-forwarded-for') || '').split(',')[0].trim() || null
  const { error: kErr } = await db.from('cleaner_packs').update({
    profile_id: prof.id, company, abn, contact: contact || name, contact_phone: phone || null, insurer, policy, expiry, cert_path: cert, signed_name: sig, signed_at: now, signed_ip: ip,
  }).eq('id', k.id)
  if (kErr) {
    await db.from('profiles').delete().eq('id', prof.id)
    await db.auth.admin.deleteUser(userId).catch(() => {})
    return { ok: false, error: OFFLINE }
  }

  const h = headers(), host = h.get('x-forwarded-host') || h.get('host')
  const site = host ? `${h.get('x-forwarded-proto') || 'https'}://${host}` : 'https://portal.corecleaning.services'
  const tested = !process.env.RESEND_API_KEY
  if (!tested) {
    await sendEmail(k.email, 'Your Core Cleaning portal login', loginEmail(k.first_name, k.email, pw, site)).catch(() => {})
    await sendEmail('admin@corecleaning.services', `${name} signed the subcontractor pack`,
      `<p><strong>${esc(name)}</strong> signed the subcontractor pack for <strong>${esc(company)}</strong> (ABN ${esc(abnFmt(abn))}).</p><p>Public liability: ${esc(insurer)}, policy ${esc(policy)}, expires ${esc(expiry.split('-').reverse().join('/'))}.</p><p>Their cleaner login was emailed to them. See the signed pack under Team in the hub.</p>`).catch(() => {})
  }
  await sendPushToRole('admin', { title: `${name} signed the pack`, body: `${company} · their login was emailed to them`, url: '/hub/team' }).catch(() => {})
  revalidatePath('/hub', 'layout')
  // on the test site no email goes out, so the page shows the starter password instead
  return { ok: true, name, email: k.email, tested, ...(tested ? { pw } : {}) }
}
