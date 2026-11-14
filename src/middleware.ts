import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getPortalKey, cookiePrefix } from '@/lib/supabase/portal'

/**
 * Keeps each portal's sign-in fresh. Pages can't save cookies, so without this a page that refreshes an expired
 * sign-in throws the new one away; the browser then reuses the old refresh token, Supabase treats that as reuse
 * and ends the session (cleaners were logged out about an hour after signing in).
 *
 * This only refreshes, it never redirects: each portal's own layout still decides who may see what.
 * getSession() reads the cookie locally and only calls Supabase when the access token has expired,
 * so ordinary page loads don't pay for an extra round trip.
 */
export async function middleware(request: NextRequest) {
  const portal = getPortalKey(request.nextUrl.pathname)
  const prefix = cookiePrefix(portal)
  // No sign-in cookie for this portal: nothing to refresh.
  if (!request.cookies.getAll().some(c => c.name.startsWith(prefix))) return NextResponse.next()

  // Cookie writes are collected and applied once at the end, so a sign-in split over several cookies keeps every part.
  const writes: { name: string; value: string; options: any }[] = []
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookieOptions: { name: prefix, maxAge: 400 * 24 * 60 * 60, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' },
    cookies: {
      get: (name: string) => request.cookies.get(name)?.value,
      set: (name: string, value: string, options: any) => { request.cookies.set(name, value); writes.push({ name, value, options }) },
      remove: (name: string, options: any) => { request.cookies.delete(name); writes.push({ name, value: '', options }) },
    },
  })
  try {
    await supabase.auth.getSession()
  } catch {
    // Supabase unreachable: let the page handle it as before.
  }
  if (!writes.length) return NextResponse.next()

  // The page rendering this request reads the fresh sign-in; the browser stores it for the next one.
  const headers = new Headers(request.headers)
  headers.set('cookie', request.cookies.toString())
  const response = NextResponse.next({ request: { headers } })
  for (const w of writes) response.cookies.set({ name: w.name, value: w.value, ...w.options })
  return response
}

export const config = {
  // Pages only: skip Next's own files, images, PDFs and the API routes (they check sign-in themselves).
  matcher: ['/((?!_next/static|_next/image|api/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|pdf|json|txt|xml|webmanifest)$).*)'],
}
