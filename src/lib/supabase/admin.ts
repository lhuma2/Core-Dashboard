import { createClient } from '@supabase/supabase-js'

/**
 * Service-role client — bypasses RLS.
 * Only use inside Server Actions / Route Handlers. Never expose to the browser.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      // Next 14 caches server fetches by default, which froze public pages
      // (quote, sign, welcome) on the first data they ever read.
      global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
    }
  )
}
