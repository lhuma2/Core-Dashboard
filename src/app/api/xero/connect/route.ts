import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const XERO_AUTH_URL = 'https://login.xero.com/identity/connect/authorize'

// Scopes for custom/web app (app.connections is App Store only — excluded)
const SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'accounting.settings.read',
  'accounting.invoices.read',
  'accounting.banktransactions.read',
  'accounting.reports.profitandloss.read',
].join(' ')

export async function GET() {
  const clientId = process.env.XERO_CLIENT_ID
  const redirectUri = process.env.XERO_REDIRECT_URI

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: 'Xero credentials not configured. Set XERO_CLIENT_ID and XERO_REDIRECT_URI.' },
      { status: 500 }
    )
  }

  const state = crypto.randomUUID()

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPES,
    state,
  })

  const authorizeUrl = `${XERO_AUTH_URL}?${params}`

  // Set the state cookie ON the redirect response — not on cookieStore separately
  const response = NextResponse.redirect(authorizeUrl)
  response.cookies.set('xero_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600, // 10 minutes
    path: '/',
    sameSite: 'lax',
  })

  return response
}
