import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Unauthenticated-accessible routes
const PUBLIC_ROUTES = ['/login', '/api/cleaner-calendar', '/survey']

/** Where each role lands after login */
const ROLE_HOME: Record<string, string> = {
  admin:   '/dashboard',
  manager: '/manager/dashboard',
  cleaner: '/cleaner/dashboard',
  client:  '/client/dashboard',
}

/** URL prefixes each non-admin role is allowed to visit */
const ROLE_ALLOWED: Record<string, string[]> = {
  cleaner: ['/cleaner'],
  manager: ['/manager'],
  client:  ['/client'],
}

/** Copy Supabase session cookies onto any redirect response so tokens are never lost */
function redirectWithCookies(url: URL, supabaseResponse: NextResponse): NextResponse {
  const response = NextResponse.redirect(url)
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie.name, cookie.value, cookie as any)
  })
  return response
}

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request)
  const { pathname } = request.nextUrl

  const isPublicRoute = PUBLIC_ROUTES.some((r) => pathname.startsWith(r))

  // Not authenticated → login
  if (!user && !isPublicRoute) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('redirectTo', pathname)
    return redirectWithCookies(loginUrl, supabaseResponse)
  }

  if (user) {
    const role: string = (user.user_metadata?.role as string) ?? 'admin'
    const home = ROLE_HOME[role] ?? '/dashboard'

    // On login page → redirect to role-appropriate home
    if (pathname === '/login') {
      const dest = request.nextUrl.clone()
      dest.pathname = home
      return redirectWithCookies(dest, supabaseResponse)
    }

    // API routes are allowed for any authenticated user — they handle their own auth internally
    if (pathname.startsWith('/api/')) return supabaseResponse

    // Non-admin visiting a route outside their allowed prefix → send home
    if (role !== 'admin') {
      const allowed = ROLE_ALLOWED[role] ?? []
      const isAllowed = allowed.some((prefix) => pathname.startsWith(prefix))
      if (!isAllowed) {
        const dest = request.nextUrl.clone()
        dest.pathname = home
        return redirectWithCookies(dest, supabaseResponse)
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
