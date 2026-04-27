import { createClient } from '@/lib/supabase/server'
import { ManagerFrame } from '@/components/portal/ManagerFrame'
import { SessionKeepAlive } from '@/components/portal/SessionKeepAlive'

// Persistent layout — ManagerFrame never unmounts when switching between manager tabs
export default async function ManagerPagesLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await (supabase as any).from('profiles').select('full_name').eq('user_id', user.id).single()
    : { data: null }

  return (
    <>
      <SessionKeepAlive />
      <ManagerFrame userName={profile?.full_name}>{children}</ManagerFrame>
    </>
  )
}
