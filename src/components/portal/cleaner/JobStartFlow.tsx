'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { startJobAction, cancelStartAction } from '@/actions/jobs'
import { flushPhotoQueue } from '@/lib/photoQueue'
import { uploadJobPhotoAction } from '@/actions/jobs'
import { PhotoCaptureModal } from './PhotoCaptureModal'
import { JobTimer } from './JobTimer'
import { AlertCircle } from 'lucide-react'

interface Props {
  jobId: string
  status: string
  startedAt: string | null
}

/** Owns the not_started → in_progress transition, the live timer, and the
 *  "before" photo prompt that fires immediately on Start. */
export function JobStartFlow({ jobId, status, startedAt: initialStartedAt }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [startedAt, setStartedAt] = useState(initialStartedAt)
  const [showBeforePrompt, setShowBeforePrompt] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  // Retry any before/after photos left queued from a previous offline session
  // as soon as this screen mounts (covers "reopened the app later, back online").
  useEffect(() => {
    flushPhotoQueue(jobId, async (entry) => {
      const fd = new FormData()
      fd.append('photo', new File([entry.blob], entry.fileName, { type: entry.contentType }))
      return uploadJobPhotoAction(jobId, fd, entry.phase)
    }).catch(() => {})
  }, [jobId])

  async function handleStart() {
    setLoading(true)
    setErr(null)
    try {
      const result = await startJobAction(jobId)
      if (result?.error) {
        setErr(result.error)
        setLoading(false)
        return
      }
      setStartedAt(new Date().toISOString())
      setShowBeforePrompt(true)
      router.refresh()
    } catch {
      setErr('Could not start the job. Check your connection and try again.')
      setLoading(false)
    }
  }

  async function handleCancelStart() {
    setCancelling(true)
    setErr(null)
    const result = await cancelStartAction(jobId)
    if (result?.error) {
      setErr(result.error)
      setCancelling(false)
      return
    }
    router.refresh()
  }

  if (status === 'not_started') {
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

        {showBeforePrompt && (
          <PhotoCaptureModal jobId={jobId} phase="before" onClose={() => setShowBeforePrompt(false)} />
        )}
      </div>
    )
  }

  // in_progress (or flagged, which can still be timed) — show the live timer
  if (startedAt) {
    return (
      <div className="space-y-2">
        <JobTimer startedAt={startedAt} />
        {err && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-600 leading-relaxed">{err}</p>
          </div>
        )}
        <button
          onClick={handleCancelStart}
          disabled={cancelling}
          className="w-full text-xs font-medium text-gray-400 py-2 disabled:opacity-50"
        >
          {cancelling ? 'Cancelling…' : 'Accidentally started? Cancel'}
        </button>

        {showBeforePrompt && (
          <PhotoCaptureModal jobId={jobId} phase="before" onClose={() => setShowBeforePrompt(false)} />
        )}
      </div>
    )
  }

  return null
}
