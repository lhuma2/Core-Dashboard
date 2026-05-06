'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminMarkJobCompleteAction } from '@/actions/jobs'
import { CheckCircle2, Loader2 } from 'lucide-react'

export function AdminCompleteJobButton({ jobId }: { jobId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function handleClick() {
    if (loading || done) return
    setLoading(true)
    setError(null)
    const result = await adminMarkJobCompleteAction(jobId, undefined, 'admin')
    setLoading(false)
    if (result.error) {
      setError(result.error)
    } else {
      setDone(true)
      router.refresh()
    }
  }

  if (done) {
    return (
      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Marked complete
      </span>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={loading}
        className="flex items-center gap-1.5 text-xs font-semibold text-white bg-black rounded-xl px-3 py-1.5 hover:bg-gray-800 disabled:opacity-40 transition-colors active:scale-95"
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
        Mark complete
      </button>
      {error && <p className="text-[10px] text-red-500 max-w-[140px] text-right">{error}</p>}
    </div>
  )
}
