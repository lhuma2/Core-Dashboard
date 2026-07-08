'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { startJobAction, cancelStartAction, uploadJobPhotoAction } from '@/actions/jobs'
import { startBondJobAction, cancelStartBondJobAction, finishBondJobAction } from '@/actions/bondJobs'
import { flushPhotoQueue } from '@/lib/photoQueue'
import { PhotoCaptureModal } from './PhotoCaptureModal'
import { JobTimer } from './JobTimer'
import { AlertCircle, ChevronRight } from 'lucide-react'

type Kind = 'job_assignment' | 'bond_job'

interface Props {
  jobId: string
  status: string
  startedAt: string | null
  finishedAt?: string | null
  /** job_assignments (the regular commercial job flow) or a bond_jobs clean.
   *  Bond cleans have no separate checklist/notes "submit" page, so Finish is
   *  handled right here instead of linking out. */
  kind?: Kind
}

const ACTIONS: Record<Kind, {
  start: (id: string) => Promise<any>
  cancel: (id: string) => Promise<any>
  finish?: (id: string) => Promise<any>
}> = {
  job_assignment: { start: startJobAction, cancel: cancelStartAction },
  bond_job:       { start: startBondJobAction, cancel: cancelStartBondJobAction, finish: finishBondJobAction },
}

/** Owns the not_started → in_progress transition, the live timer, and the
 *  "before"/"after" photo prompts that fire on Start/Finish. */
export function JobStartFlow({ jobId, status, startedAt: initialStartedAt, finishedAt: initialFinishedAt, kind = 'job_assignment' }: Props) {
  const router = useRouter()
  const actions = ACTIONS[kind]
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [startedAt, setStartedAt] = useState(initialStartedAt)
  const [finishedAt, setFinishedAt] = useState(initialFinishedAt ?? null)
  const [showAfterPrompt, setShowAfterPrompt] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [status_, setStatus] = useState(status)

  // Retry any before/after photos left queued from a previous offline session
  // as soon as this screen mounts (covers "reopened the app later, back online").
  useEffect(() => {
    flushPhotoQueue(jobId, async (entry) => {
      const fd = new FormData()
      fd.append('photo', new File([entry.blob], entry.fileName, { type: entry.contentType }))
      return uploadJobPhotoAction(jobId, fd, entry.phase, entry.jobKind)
    }).catch(() => {})
  }, [jobId])

  async function handleStart() {
    setLoading(true)
    setErr(null)
    try {
      const result = await actions.start(jobId)
      if (result?.error) {
        setErr(result.error)
        setLoading(false)
        return
      }
      setStartedAt(new Date().toISOString())
      setStatus('in_progress')
      router.refresh()
    } catch {
      setErr('Could not start the job. Check your connection and try again.')
      setLoading(false)
    }
  }

  async function handleCancelStart() {
    setCancelling(true)
    setErr(null)
    const result = await actions.cancel(jobId)
    if (result?.error) {
      setErr(result.error)
      setCancelling(false)
      return
    }
    router.refresh()
  }

  async function handleFinish() {
    if (!actions.finish) return
    setFinishing(true)
    setErr(null)
    const result = await actions.finish(jobId)
    if (result?.error) {
      setErr(result.error)
      setFinishing(false)
      return
    }
    setFinishedAt(new Date().toISOString())
    setStatus('completed')
    setShowAfterPrompt(true)
    router.refresh()
  }

  if (status_ === 'not_started') {
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

  if (status_ === 'in_progress' && startedAt) {
    return (
      <div className="space-y-2">
        <JobTimer startedAt={startedAt} />
        {err && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-600 leading-relaxed">{err}</p>
          </div>
        )}

        {actions.finish && (
          <button
            onClick={handleFinish}
            disabled={finishing}
            className="flex items-center justify-center gap-2 w-full bg-black text-white font-semibold text-sm rounded-2xl py-4 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {finishing ? 'Finishing…' : 'Finish Clean'}
            {!finishing && <ChevronRight className="w-4 h-4" />}
          </button>
        )}

        <button
          onClick={handleCancelStart}
          disabled={cancelling}
          className="w-full text-xs font-medium text-gray-400 py-2 disabled:opacity-50"
        >
          {cancelling ? 'Cancelling…' : 'Accidentally started? Cancel'}
        </button>

        {showAfterPrompt && (
          <PhotoCaptureModal jobId={jobId} phase="after" jobKind={kind} onClose={() => setShowAfterPrompt(false)} />
        )}
      </div>
    )
  }

  if (status_ === 'completed') {
    return (
      <div className="space-y-2">
        {kind === 'bond_job' && (
          <div className="text-center py-4">
            <p className="text-sm font-medium text-black">✓ Clean completed</p>
            {finishedAt && (
              <p className="text-xs text-gray-400 mt-1">
                Finished at {new Date(finishedAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        )}
        {showAfterPrompt && (
          <PhotoCaptureModal jobId={jobId} phase="after" jobKind={kind} onClose={() => setShowAfterPrompt(false)} />
        )}
      </div>
    )
  }

  return null
}
