'use client'

import { useState } from 'react'
import { flagJobAction } from '@/actions/jobs'
import { useRouter } from 'next/navigation'
import { AlertTriangle, X } from 'lucide-react'

interface Props {
  jobId: string
  clientId: string
}

export function FlagModal({ jobId, clientId }: Props) {
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleFlag() {
    if (!description.trim()) return setError('Please describe the issue')
    setSubmitting(true)
    const result = await flagJobAction({ jobId, clientId, description: description.trim() })
    setSubmitting(false)
    if (result.error) return setError(result.error)
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center justify-center gap-2 w-full border border-gray-200 text-gray-600 font-medium text-sm rounded-2xl py-4 active:scale-[0.98] transition-all"
      >
        <AlertTriangle className="w-4 h-4" />
        Flag Issue
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-black">Flag an Issue</h3>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500">
              Describe the issue. Your manager will be notified.
            </p>
            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}
            <textarea
              value={description}
              onChange={(e) => { setDescription(e.target.value); setError(null) }}
              placeholder="Describe the issue…"
              rows={4}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-black transition-colors"
            />
            <button
              onClick={handleFlag}
              disabled={submitting || !description.trim()}
              className="w-full bg-black text-white font-semibold text-sm rounded-2xl py-4 disabled:opacity-40 active:scale-[0.98] transition-all"
            >
              {submitting ? 'Submitting…' : 'Submit Flag'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
