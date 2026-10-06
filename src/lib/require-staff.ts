import { createClient } from '@/lib/supabase/server'

const NON_STAFF = ['cleaner', 'client', 'manager']

/** Null when the caller is signed in as admin/staff, otherwise the reason they aren't allowed. */
export async function requireStaff(): Promise<string | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 'Please sign in again.'
  const role = (user.user_metadata?.role as string) ?? 'admin'
  return NON_STAFF.includes(role) ? 'Not allowed.' : null
}
