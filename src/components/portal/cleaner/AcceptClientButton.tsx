'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { acceptClientAssignmentAction } from '@/actions/manager'

export function AcceptClientButton({ clientId }: { clientId: string }) {
  const router  = useRouter()
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleAccept() {
    setLoading(true)
    setErr(null)
    try {
      const r = await acceptClientAssignmentAction(clientId)
      if (r?.error) { setErr(r.error); setLoading(false); return }
    } catch {
      setErr('Could not accept. Check your connection and try again.')
      setLoading(false)
      return
    }
    router.refresh()
  }

  return (
    <div className="space-y-2">
      {err && <p className="text-xs text-red-600">{err}</p>}
      <button
        onClick={handleAccept}
        disabled={loading}
        className="w-full bg-black text-white text-sm font-semibold rounded-2xl py-3 disabled:opacity-40 active:scale-[0.98] transition-all"
      >
        {loading ? 'Accepting…' : 'Accept'}
      </button>
    </div>
  )
}
