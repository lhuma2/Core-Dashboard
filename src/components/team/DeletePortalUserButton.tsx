'use client'

import { useState } from 'react'
import { deletePortalUserAction } from '@/actions/team'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

interface Props {
  userId: string
  userName?: string | null
}

export function DeletePortalUserButton({ userId, userName }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    setLoading(true)
    await deletePortalUserAction(userId)
    router.refresh()
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Remove {userName?.split(' ')[0]}?</span>
        <button onClick={handleDelete} disabled={loading} className="text-xs text-red-600 font-semibold hover:text-red-700 disabled:opacity-50">
          {loading ? '…' : 'Yes'}
        </button>
        <button onClick={() => setConfirming(false)} className="text-xs text-gray-400 hover:text-gray-600">
          No
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  )
}
