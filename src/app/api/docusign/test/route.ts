import { NextResponse } from 'next/server'
import { isDocusignConfigured, consentUrl } from '@/lib/documents/docusign'

// TEMPORARY: validate DocuSign JWT auth without sending anything. Remove after.
export const runtime = 'nodejs'

async function tryEnv(oauthBase: string, subOverride?: string) {
  const integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY?.trim()
  const userId = subOverride || process.env.DOCUSIGN_USER_ID?.trim()
  const jwt = (await import('jsonwebtoken')).default
  const now = Math.floor(Date.now() / 1000)
  const rsaKey = process.env.DOCUSIGN_RSA_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/\r/g, '').trim() as string
  const assertion = jwt.sign(
    { iss: integrationKey, sub: userId, aud: oauthBase, iat: now, exp: now + 3000, scope: 'signature impersonation' },
    rsaKey, { algorithm: 'RS256' }
  )
  const res = await fetch(`https://${oauthBase}/oauth/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  })
  const json: any = await res.json().catch(() => ({}))
  return { oauthBase, status: res.status, ok: res.ok, error: json?.error, description: json?.error_description }
}

export async function GET(req: Request) {
  if (!isDocusignConfigured()) return NextResponse.json({ configured: false })
  const sub = new URL(req.url).searchParams.get('sub') || undefined
  try {
    const demo = await tryEnv('account-d.docusign.com', sub)
    return NextResponse.json({ subTried: sub || 'env', demo, consentUrl: consentUrl() })
  } catch (e: any) {
    return NextResponse.json({ ok: false, signError: e?.message ?? String(e) }, { status: 500 })
  }
}
