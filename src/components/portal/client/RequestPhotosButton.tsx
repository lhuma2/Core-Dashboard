'use client'

import { useState } from 'react'
import { requestPhotosAction } from '@/actions/portal'
import { Camera } from 'lucide-react'

export function RequestPhotosButton({ clientId }: { clientId: string }) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRequest() {
    setLoading(true)
    setError(null)
    const result = await requestPhotosAction(clientId)
    setLoading(false)
    if (result?.error) return setError(result.error)
    setDone(true)
    setTimeout(() => setDone(false), 5000)
  }

  if (done) {
    return (
      <div className="flex items-center gap-2 bg-black text-white font-medium text-sm rounded-full px-5 py-2.5">
        <Camera className="w-4 h-4" />
        Request sent ✓
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={handleRequest}
        disabled={loading}
        className="flex items-center gap-2 bg-black text-white font-medium text-sm rounded-full px-5 py-2.5 hover:bg-gray-900 disabled:opacity-50 transition-all"
      >
        <Camera className="w-4 h-4" />
        {loading ? 'Requesting…' : 'Request Photos'}
      </button>
      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  )
}
