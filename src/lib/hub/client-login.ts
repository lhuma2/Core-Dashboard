import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'
import { starterPw } from './team'
import { portalFirst } from './proposals'

const esc = (v: string) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

export type LoginResult =
  | { ok: true; made: true; email: string; first: string; pw: string; tested: boolean }
  | { ok: true; made: false; email: string; first: string }
  | { ok: false; error: string }

function welcomeMail(first: string, email: string, pw: string, site: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px 16px;color:#13201a">
  <div style="background:#00250e;color:#fff;padding:18px 20px;border-radius:10px 10px 0 0;font-size:18px;font-weight:700">Core Cleaning</div>
  <div style="border:1px solid #d5dfda;border-top:0;border-radius:0 0 10px 10px;padding:22px 20px;font-size:15px;line-height:1.5">
    <p style="margin:0 0 12px">Hi ${esc(first)},</p>
    <p style="margin:0 0 12px">Welcome to Core Cleaning. Your client portal is ready. You can see your upcoming cleans, ask for photos or an extra clean, send us a request and find your documents, all in one place.</p>
    <p style="margin:0 0 12px;background:#f3f5f4;border-radius:8px;padding:10px 12px;font-family:Menlo,monospace;font-size:14px">Website: ${esc(site.replace(/^https?:\/\//, ''))}/client/login<br>Username: ${esc(email)}<br>Password: ${esc(pw)}</p>
    <p style="margin:0 0 12px">The first time you log in it will ask you to choose your own password. On iPhone, open the portal in Safari, tap Share, then Add to Home Screen so it works like an app.</p>
    <p style="margin:0">Kind regards,<br><strong>Laith Humadi</strong><br>Core Cleaning · 0407 026 360 · admin@corecleaning.services</p>
  </div></div>`
}

/**
 * The client's portal login, made when their service agreement is signed (or when Laith sets up the client from an
 * accepted proposal, whichever comes second). Starter password: their first name (plus the year if it's under 6
 * letters), changed on first login. If the client already has a login, nothing changes.
 */
export async function makeClientLogin(clientId: string, name: string, email: string, site: string, year: number): Promise<LoginResult> {
  const db = createAdminClient() as any
  const first = portalFirst(name)
  const addr = String(email || '').trim().toLowerCase()
  const { data: have, error } = await db.from('profiles').select('id, email').eq('linked_client_id', clientId).eq('role', 'client').limit(1)
  if (error) return { ok: false, error: 'offline' }
  if (have?.length) return { ok: true, made: false, email: have[0].email || addr, first }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return { ok: false, error: 'no_email' }
  const pw = starterPw(first, year)
  const made = await db.auth.admin.createUser({ email: addr, password: pw, email_confirm: true, user_metadata: { role: 'client', full_name: name } })
  if (made.error || !made.data?.user) return { ok: false, error: /already|registered|exists/i.test(String(made.error?.message)) ? 'taken' : 'offline' }
  const ins = await db.from('profiles').insert({ user_id: made.data.user.id, role: 'client', full_name: name, email: addr, linked_client_id: clientId })
  if (ins.error) { await db.auth.admin.deleteUser(made.data.user.id).catch(() => {}); return { ok: false, error: 'offline' } }
  const tested = !process.env.RESEND_API_KEY
  if (!tested) await sendEmail(addr, 'Your Core Cleaning client portal', welcomeMail(first, addr, pw, site)).catch(() => {})
  return { ok: true, made: true, email: addr, first, pw, tested }
}

/** The welcome email again, with the starter password reset (from the agreement viewer's portal section). Only while
 *  they haven't chosen their own password yet: after that, Forgot password on the login page is the way back in. */
export async function resendClientWelcome(clientId: string, site: string, year: number): Promise<{ ok: true; email: string; tested: boolean; pw: string } | { ok: false; error: string }> {
  const db = createAdminClient() as any
  const { data: p, error } = await db.from('profiles').select('id, user_id, email, full_name, password_set_at').eq('linked_client_id', clientId).eq('role', 'client').limit(1).maybeSingle()
  if (error) return { ok: false, error: 'offline' }
  if (!p) return { ok: false, error: 'none' }
  if (p.password_set_at) return { ok: false, error: 'chosen' }
  const first = portalFirst(p.full_name || '')
  const pw = starterPw(first, year)
  const u = await db.auth.admin.updateUserById(p.user_id, { password: pw })
  if (u.error) return { ok: false, error: 'offline' }
  const tested = !process.env.RESEND_API_KEY
  if (!tested) await sendEmail(p.email, 'Your Core Cleaning client portal', welcomeMail(first, p.email, pw, site)).catch(() => {})
  return { ok: true, email: p.email, tested, pw }
}
