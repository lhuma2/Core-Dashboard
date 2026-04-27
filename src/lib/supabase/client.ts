import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        // Persist session cookies for 400 days so iOS PWA swipe-up never clears them
        maxAge: 400 * 24 * 60 * 60,
        sameSite: 'lax',
        secure: true,
      },
    }
  )
}
