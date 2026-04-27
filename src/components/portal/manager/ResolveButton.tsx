'use client'

import { useState } from 'react'
import { resolveFlagAction, resolveClientIssueAction } from '@/actions/jobs'
import { useRouter } from 'next/navigation'

interface Props {
  flagId: string
  type: 'flag' | 'issue'
}

export function ResolveButton({ flagId, type }: Props) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading]         = useState(false)
  const router = useRouter()

  async function handleConfirm() {
    setLoading(true)
    const result = type === 'flag'
      ? await resolveFlagAction(flagId)
      : await resolveClientIssueAction(flagId)
    setLoading(false)
    setShowConfirm(false)
    if (result.success) router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="flex-shrink-0 text-xs font-semibold border border-black text-black px-3 py-1.5 rounded-full active:scale-[0.96] transition-all"
      >
        Resolved
      </button>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-8">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <p className="text-base font-bold text-black mb-1 text-center">Was this issue resolved?</p>
            <p className="text-xs text-gray-400 text-center mb-6">This will mark the item as closed.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={loading}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                No
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="flex-1 py-3 rounded-xl bg-black text-white text-sm font-semibold active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {loading ? '…' : 'Yes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
