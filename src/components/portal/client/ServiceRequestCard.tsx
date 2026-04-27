'use client'

import { useState } from 'react'
import { requestServiceAction } from '@/actions/portal'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface Props {
  serviceName: string
  clientId: string
}

const FREQUENCIES = [
  { value: 'one-off',    label: 'One-off' },
  { value: 'monthly',   label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually',  label: 'Annually' },
]

export function ServiceRequestCard({ serviceName, clientId }: Props) {
  const [open, setOpen] = useState(false)
  const [frequency, setFrequency] = useState('one-off')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    const result = await requestServiceAction({
      client_id:    clientId,
      service_name: serviceName,
      frequency,
      notes:        notes.trim() || null,
    })
    setSubmitting(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setDone(true)
    setNotes('')
    setFrequency('one-off')
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <button
        onClick={() => { if (!done) setOpen((o) => !o) }}
        className="w-full flex items-center justify-between px-6 py-5 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-black">{serviceName}</span>
        </div>
        {done ? (
          <span className="text-xs font-semibold text-green-600 border border-green-200 bg-green-50 px-3 py-1 rounded-full">
            Request Sent
          </span>
        ) : open ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {open && !done && (
        <div className="px-6 pb-6 border-t border-gray-50">
          <div className="pt-5 space-y-4">
            {/* Frequency */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
                Frequency
              </label>
              <div className="flex flex-wrap gap-2">
                {FREQUENCIES.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setFrequency(f.value)}
                    className={`text-xs font-medium px-4 py-2 rounded-full border transition-all ${
                      frequency === f.value
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any specific requirements or details…"
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-black transition-colors"
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 border border-gray-200 text-gray-600 font-medium text-sm rounded-full py-3 hover:border-gray-400 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 bg-black text-white font-semibold text-sm rounded-full py-3 disabled:opacity-40 hover:bg-gray-900 transition-all"
              >
                {submitting ? 'Sending…' : 'Request Quote'}
              </button>
            </div>
          </div>
        </div>
      )}

      {open && done && (
        <div className="px-6 pb-6 border-t border-gray-50">
          <div className="pt-5 text-center">
            <p className="text-sm font-semibold text-black">Request sent!</p>
            <p className="text-sm text-gray-500 mt-1">We'll be in touch shortly.</p>
          </div>
        </div>
      )}
    </div>
  )
}
