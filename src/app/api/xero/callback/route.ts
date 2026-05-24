import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const XERO_TOKEN_URL = 'https://identity.xero.com/connect/token'
const XERO_CONNECTIONS_URL = 'https://api.xero.com/connections'

function dashboardRedirect(request: NextRequest, reason: string) {
  console.log('[xero/callback] redirecting to dashboard, reason:', reason)
  return NextResponse.redirect(new URL(`/dashboard?xero=${reason}`, request.url))
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  console.log('[xero/callback] received — code:', !!code, 'state:', !!state, 'error:', error)

  if (error) return dashboardRedirect(request, `error_${error}`)
  if (!code || !state) return dashboardRedirect(request, 'missing_params')

  // Validate CSRF state
  const cookieStore = cookies()
  const storedState = cookieStore.get('xero_oauth_state')?.value
  console.log('[xero/callback] state check — stored:', storedState, 'received:', state, 'match:', storedState === state)

  if (!storedState || storedState !== state) {
    return dashboardRedirect(request, 'invalid_state')
  }

  // Clear state cookie
  cookieStore.set('xero_oauth_state', '', { maxAge: 0, path: '/' })

  const clientId     = process.env.XERO_CLIENT_ID!
  const clientSecret = process.env.XERO_CLIENT_SECRET!
  const redirectUri  = process.env.XERO_REDIRECT_URI!
  const credentials  = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  console.log('[xero/callback] exchanging code for tokens, redirectUri:', redirectUri)

  // Exchange code → tokens
  let tokenData: any
  try {
    const tokenRes = await fetch(XERO_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
    })

    const body = await tokenRes.text()
    console.log('[xero/callback] token response status:', tokenRes.status, body.slice(0, 200))

    if (!tokenRes.ok) return dashboardRedirect(request, 'token_exchange_failed')
    tokenData = JSON.parse(body)
  } catch (err) {
    console.error('[xero/callback] token exchange error:', err)
    return dashboardRedirect(request, 'network_error')
  }

  // Fetch tenant
  let tenant: { tenantId: string; tenantName: string } | null = null
  try {
    const connRes = await fetch(XERO_CONNECTIONS_URL, {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'Accept': 'application/json' },
    })
    console.log('[xero/callback] connections status:', connRes.status)
    if (connRes.ok) {
      const connections: any[] = await connRes.json()
      console.log('[xero/callback] connections:', JSON.stringify(connections.slice(0, 2)))
      const first = connections[0]
      if (first) tenant = { tenantId: first.tenantId, tenantName: first.tenantName ?? 'Delta Cleaning' }
    }
  } catch (err) {
    console.error('[xero/callback] connections error:', err)
  }

  if (!tenant) return dashboardRedirect(request, 'no_tenant')

  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000)

  // Save tokens — delete any existing row first (singleton pattern)
  const supabase = createClient()
  await (supabase as any).from('xero_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  const { error: insertError } = await (supabase as any).from('xero_tokens').insert({
    tenant_id:     tenant.tenantId,
    tenant_name:   tenant.tenantName,
    access_token:  tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at:    expiresAt.toISOString(),
  })

  if (insertError) {
    console.error('[xero/callback] db insert error:', insertError)
    return dashboardRedirect(request, 'db_error')
  }

  console.log('[xero/callback] tokens saved, tenant:', tenant.tenantName)
  return dashboardRedirect(request, 'connected')
}
