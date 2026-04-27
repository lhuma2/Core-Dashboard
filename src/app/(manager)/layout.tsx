import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NotificationGate } from '@/components/portal/cleaner/NotificationGate'

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const role = user.user_metadata?.role ?? 'admin'
  if (role !== 'manager') redirect('/login')

  return <NotificationGate>{children}</NotificationGate>
}
