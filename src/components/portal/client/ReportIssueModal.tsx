'use client'

import { useState } from 'react'
import { reportIssueAction } from '@/actions/portal'
import { MessageSquare, X } from 'lucide-react'

export function ReportIssueModal({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!description.trim()) return setError('Please describe the issue')
    setSubmitting(true)
    const result = await reportIssueAction(clientId, description.trim())
    setSubmitting(false)
    if (result.error) return setError(result.error)
    setDone(true)
    setDescription('')
    setTimeout(() => { setDone(false); setOpen(false) }, 2500)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 border border-black text-black font-medium text-sm rounded-full px-5 py-2.5 hover:bg-black hover:text-white transition-all"
      >
        <MessageSquare className="w-4 h-4" />
        Report an Issue
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-6"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-black">Report an Issue</h3>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-black transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {done ? (
              <div className="text-center py-6">
                <p className="text-xl font-bold text-black mb-1">✓ Submitted</p>
                <p className="text-sm text-gray-500">Our team has been notified.</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-500 mb-5">
                  Describe the issue and our team will follow up promptly.
                </p>
                {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
                <textarea
                  value={description}
                  onChange={(e) => { setDescription(e.target.value); setError(null) }}
                  placeholder="Describe the issue…"
                  rows={5}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-black transition-colors mb-5"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => setOpen(false)}
                    className="flex-1 border border-gray-200 text-gray-600 font-medium text-sm rounded-full py-3 hover:border-gray-400 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !description.trim()}
                    className="flex-1 bg-black text-white font-semibold text-sm rounded-full py-3 disabled:opacity-40 hover:bg-gray-900 transition-all"
                  >
                    {submitting ? 'Submitting…' : 'Submit'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
