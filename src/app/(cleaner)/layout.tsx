import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NotificationGate } from '@/components/portal/cleaner/NotificationGate'
import { SessionKeepAlive } from '@/components/portal/SessionKeepAlive'

export default async function CleanerLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const role = user.user_metadata?.role ?? 'admin'
  if (role !== 'cleaner') redirect('/login')

  return (
    <>
      <SessionKeepAlive />
      <NotificationGate>{children}</NotificationGate>
    </>
  )
}
