import type { Metadata, Viewport } from 'next'
import { crewMe } from '@/lib/crew/data'
import { CrewTop } from '@/components/crew/CrewTop'
import './cleaner/crew.css'

export const metadata: Metadata = { title: 'Core Cleaning · Cleaner app' }
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#00250e' }
export const dynamic = 'force-dynamic'

// The new cleaner app (mock-up Cleaner.dc.html), replacing the old /cleaner/dashboard.
export default async function CrewLayout({ children }: { children: React.ReactNode }) {
  const me = await crewMe()
  return (
    <div className="cp">
      <CrewTop initial={me ? (me.first.charAt(0) || 'C').toUpperCase() : null} email={me?.email || ''} />
      <main className="wrap">{children}</main>
    </div>
  )
}
