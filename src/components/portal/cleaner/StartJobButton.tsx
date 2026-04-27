'use client'

import { useState } from 'react'
import { startJobAction } from '@/actions/jobs'
import { useRouter } from 'next/navigation'

export function StartJobButton({ jobId }: { jobId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleStart() {
    setLoading(true)
    const result = await startJobAction(jobId)
    setLoading(false)
    if (result.success) router.refresh()
  }

  return (
    <button
      onClick={handleStart}
      disabled={loading}
      className="w-full bg-white border-2 border-black text-black font-semibold text-sm rounded-2xl py-4 active:scale-[0.98] transition-all disabled:opacity-50"
    >
      {loading ? 'Starting…' : 'Start Job'}
    </button>
  )
}
