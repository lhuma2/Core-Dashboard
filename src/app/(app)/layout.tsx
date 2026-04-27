import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/layout/AppShell'

const ROLE_HOME: Record<string, string> = {
  cleaner: '/cleaner/dashboard',
  client:  '/client/dashboard',
  manager: '/manager/dashboard',
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // If a non-admin session sneaks in, send them to their own portal
  const role = (user.user_metadata?.role as string) ?? 'admin'
  if (role in ROLE_HOME) {
    redirect(ROLE_HOME[role])
  }

  return <AppShell userEmail={user.email}>{children}</AppShell>
}
