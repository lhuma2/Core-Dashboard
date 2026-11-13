import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/** The client portal's own sign-in (cookie "sb-client"), read and refreshed explicitly, like the cleaner app. */
export function clientServer() {
  const store = cookies()
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookieOptions: { name: 'sb-client', maxAge: 400 * 24 * 60 * 60, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' },
    cookies: {
      get: (name: string) => store.get(name)?.value,
      set: (name: string, value: string, options: any) => { try { store.set({ name, value, ...options }) } catch { /* page render: the browser refreshes it */ } },
      remove: (name: string, options: any) => { try { store.set({ name, value: '', ...options }) } catch { /* page render */ } },
    },
  })
}
