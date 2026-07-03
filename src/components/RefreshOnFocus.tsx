'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Keeps devices in sync: when you switch back to a tab/device (it regains focus
// or becomes visible), re-fetch the server data. So an action taken on your
// laptop shows up on your phone the moment you open it — no manual refresh.
// Throttled so rapid focus toggles don't hammer the server.
export function RefreshOnFocus() {
  const router = useRouter()
  useEffect(() => {
    let last = Date.now()
    const refresh = () => {
      if (Date.now() - last < 3000) return
      last = Date.now()
      router.refresh()
    }
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [router])
  return null
}
