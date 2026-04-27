'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { acceptClientAssignmentAction } from '@/actions/manager'

export function AcceptClientButton({ clientId }: { clientId: string }) {
  const router  = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleAccept() {
    setLoading(true)
    await acceptClientAssignmentAction(clientId)
    router.refresh()
  }

  return (
    <button
      onClick={handleAccept}
      disabled={loading}
      className="w-full bg-black text-white text-sm font-semibold rounded-2xl py-3 disabled:opacity-40 active:scale-[0.98] transition-all"
    >
      {loading ? 'Accepting…' : 'Accept'}
    </button>
  )
}
