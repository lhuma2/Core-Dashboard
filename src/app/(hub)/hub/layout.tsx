import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import './hub.css'

const ROLE_HOME: Record<string, string> = {
  cleaner: '/cleaner/app',
  client: '/client/app',
  manager: '/manager/dashboard',
}

export const metadata = { title: 'Core Cleaning Hub' }

// The new hub (being built on branch claude/new-portal). Admin only; other roles go to their own portal.
export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/hub')
  const role = (user.user_metadata?.role as string) ?? 'admin'
  if (role in ROLE_HOME) redirect(ROLE_HOME[role])
  const initial = (user.user_metadata?.full_name || user.email || 'L').trim().charAt(0).toUpperCase()

  return (
    <div className="hub">
      <header className="top">
        <Link href="/hub" aria-label="Core Cleaning, back to the dashboard">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo" src="/hub-logo-white.png" alt="Core Cleaning" />
        </Link>
        <span className="avatar" aria-label={`Signed in as ${user.email ?? ''}`}>{initial}</span>
      </header>
      <main className="wrap">{children}</main>
    </div>
  )
}
