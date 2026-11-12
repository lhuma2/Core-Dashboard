'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Keeps a hub list current: refreshes when you come back to the tab, and every 30 seconds while it's open,
 *  so a quote the client accepts (or an agreement they sign) shows up without pressing refresh. */
export function useLiveRefresh(ms = 30000) {
  const router = useRouter()
  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') router.refresh() }
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('focus', tick)
    const t = window.setInterval(tick, ms)
    return () => { document.removeEventListener('visibilitychange', tick); window.removeEventListener('focus', tick); window.clearInterval(t) }
  }, [router, ms])
}
