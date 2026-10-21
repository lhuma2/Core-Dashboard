'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { shouldHoldRefresh } from '@/lib/photoActivity'

// Same as RefreshOnFocus (re-fetch the server data when the app comes back to the
// foreground, so changes made elsewhere show up), except it holds off while the
// cleaner is taking or uploading photos — returning from the photo picker counts
// as regaining focus, and re-loading the page then slowed the uploads right down.
// The next focus after the photo work finishes refreshes as normal.
export function CleanerRefreshOnFocus() {
  const router = useRouter()
  useEffect(() => {
    let last = Date.now()
    const refresh = () => {
      if (Date.now() - last < 3000) return
      // Stamped before the photo check so focus + visibilitychange (both fire on
      // return) count as one return, not a held one followed by a refresh.
      last = Date.now()
      if (shouldHoldRefresh()) return
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
