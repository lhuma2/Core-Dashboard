import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/** The cleaner app's own sign-in (cookie "sb-cleaner"), read and refreshed explicitly. The project's root
 *  middleware.ts doesn't run (the app lives under src/), so the x-portal header the shared helper relies on is
 *  never set; naming the cookie here keeps a cleaner's session apart from staff sessions in the same browser. */
export function crewServer() {
  const store = cookies()
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookieOptions: { name: 'sb-cleaner', maxAge: 400 * 24 * 60 * 60, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' },
    cookies: {
      get: (name: string) => store.get(name)?.value,
      set: (name: string, value: string, options: any) => { try { store.set({ name, value, ...options }) } catch { /* page render: the browser refreshes it */ } },
      remove: (name: string, options: any) => { try { store.set({ name, value: '', ...options }) } catch { /* page render */ } },
    },
  })
}
