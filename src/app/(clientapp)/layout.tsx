import type { Metadata, Viewport } from 'next'
import { clientMe } from '@/lib/clientapp/data'
import { ClientTop } from '@/components/clientapp/ClientTop'
import './client/client.css'

export const metadata: Metadata = { title: 'Core Cleaning · Client portal' }
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#00250e' }
export const dynamic = 'force-dynamic'

// The new client portal (mock-up Client.dc.html), replacing the old /client/dashboard pages.
export default async function ClientPortalLayout({ children }: { children: React.ReactNode }) {
  const me = await clientMe()
  const ini = me ? me.name.replace(/^(dr|mr|mrs|ms|miss|prof)\.?\s+/i, '').split(/\s+/).filter(Boolean).map(w => w.charAt(0)).join('').slice(0, 2).toUpperCase() || 'C' : null
  return (
    <div className="clp">
      <ClientTop initials={ini} email={me?.email || ''} />
      <main className="wrap">{children}</main>
    </div>
  )
}
