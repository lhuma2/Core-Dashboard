import { NextResponse } from 'next/server'
import { isDocusignConfigured, consentUrl } from '@/lib/documents/docusign'

// TEMPORARY: validate DocuSign JWT auth without sending anything. Remove after.
export const runtime = 'nodejs'

export async function GET() {
  if (!isDocusignConfigured()) return NextResponse.json({ configured: false })
  try {
    const c = {
      integrationKey: process.env.DOCUSIGN_INTEGRATION_KEY?.trim(),
      userId: process.env.DOCUSIGN_USER_ID?.trim(),
      oauthBase: (process.env.DOCUSIGN_OAUTH_BASE || 'account-d.docusign.com').trim(),
    }
    const jwt = (await import('jsonwebtoken')).default
    const now = Math.floor(Date.now() / 1000)
    const rsaKey = process.env.DOCUSIGN_RSA_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/\r/g, '').trim() as string
    const assertion = jwt.sign(
      { iss: c.integrationKey, sub: c.userId, aud: c.oauthBase, iat: now, exp: now + 3000, scope: 'signature impersonation' },
      rsaKey, { algorithm: 'RS256' }
    )
    const res = await fetch(`https://${c.oauthBase}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    })
    const json: any = await res.json().catch(() => ({}))
    if (res.ok) return NextResponse.json({ ok: true, authenticated: true })
    return NextResponse.json({ ok: false, status: res.status, error: json?.error, description: json?.error_description, consentUrl: json?.error === 'consent_required' ? consentUrl() : undefined })
  } catch (e: any) {
    return NextResponse.json({ ok: false, signError: e?.message ?? String(e) }, { status: 500 })
  }
}
