'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle } from 'lucide-react'
import { adminMarkJobCompleteAction } from '@/actions/jobs'

interface Props {
  jobId: string
  currentStatus: string
}

export function MarkJobCompleteButton({ jobId, currentStatus }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(currentStatus === 'completed')

  if (done) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg">
        <CheckCircle className="w-3.5 h-3.5" />
        Complete
      </span>
    )
  }

  async function handleClick() {
    if (!confirm('Mark this job as complete? This will update the cleaner and client portals.')) return
    setLoading(true)
    const result = await adminMarkJobCompleteAction(jobId, 'Marked complete by admin override')
    setLoading(false)
    if (result.error) {
      alert(result.error)
      return
    }
    setDone(true)
    router.refresh()
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-1 text-xs font-semibold text-[#1e3a5f] border border-[#1e3a5f]/20 bg-white hover:bg-[#1e3a5f] hover:text-white px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
    >
      <CheckCircle className="w-3.5 h-3.5" />
      {loading ? '…' : 'Force Complete'}
    </button>
  )
}
