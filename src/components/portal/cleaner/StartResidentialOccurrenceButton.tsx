'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { startResidentialOccurrenceAction } from '@/actions/residentialJobs'
import { AlertCircle } from 'lucide-react'

/** Starts (creating on first tap) today's dated instance of a recurring
 *  residential template. Mirrors StartCleanButton's simple pattern — no GPS
 *  check, since residential/bond cleans never gate Start on location. */
export function StartResidentialOccurrenceButton({ templateId }: { templateId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleStart() {
    setLoading(true)
    setErr(null)
    const result = await startResidentialOccurrenceAction(templateId)
    if (result?.error) {
      setErr(result.error)
      setLoading(false)
      return
    }
    router.refresh()
  }

  return (
    <div className="space-y-2">
      {err && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-600 leading-relaxed">{err}</p>
        </div>
      )}
      <button
        onClick={handleStart}
        disabled={loading}
        className="w-full bg-white border-2 border-black text-black font-semibold text-sm rounded-2xl py-4 active:scale-[0.98] transition-all disabled:opacity-50"
      >
        {loading ? 'Starting…' : 'Start Job'}
      </button>
    </div>
  )
}
