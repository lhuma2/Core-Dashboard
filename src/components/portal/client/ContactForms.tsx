'use client'

import { useState } from 'react'
import { submitClientFeedbackAction } from '@/actions/portal'

const AREAS = [
  'Reception',
  'Bathrooms',
  'Kitchen',
  'Office',
  'Breakroom',
  'Exterior',
  'Other',
]

interface JobDate {
  id: string
  scheduled_date: string
  completed_at: string | null
}

interface Props {
  clientId: string
  recentJobs: JobDate[]
}

function formatDateAU(dateStr: string) {
  return new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'Australia/Brisbane',
  })
}

// ── Popup overlay ─────────────────────────────────────────────────────────────
function SuccessPopup({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-sm p-8 shadow-xl text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-base font-semibold text-black leading-snug">{message}</p>
        <button
          onClick={onClose}
          className="mt-6 w-full bg-black text-white font-semibold text-sm rounded-full py-3 hover:bg-gray-900 transition-all"
        >
          Done
        </button>
      </div>
    </div>
  )
}

// ── Report an Issue ───────────────────────────────────────────────────────────
function ReportIssueForm({ clientId, recentJobs }: Props) {
  const [serviceDate, setServiceDate] = useState('')
  const [area, setArea] = useState('')
  const [description, setDescription] = useState('')
  const [requestPhotos, setRequestPhotos] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) { setError('Please describe the issue.'); return }
    setSubmitting(true)
    setError(null)
    const result = await submitClientFeedbackAction({
      client_id:      clientId,
      type:           'issue',
      message:        description.trim(),
      service_date:   serviceDate || null,
      area:           area || null,
      request_photos: requestPhotos,
    })
    setSubmitting(false)
    if (result.error) { setError(result.error); return }
    setShowSuccess(true)
    setServiceDate('')
    setArea('')
    setDescription('')
    setRequestPhotos(false)
  }

  return (
    <>
      {showSuccess && (
        <SuccessPopup
          message="Thanks for letting us know, we've got this. Laith and your assigned team leader have been notified and we'll follow this up shortly."
          onClose={() => setShowSuccess(false)}
        />
      )}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Service date */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
            Service Date
          </label>
          <select
            value={serviceDate}
            onChange={(e) => setServiceDate(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors bg-white appearance-none"
          >
            <option value="">Select a date (optional)</option>
            {recentJobs.map((job) => (
              <option key={job.id} value={job.scheduled_date}>
                {formatDateAU(job.scheduled_date)}
              </option>
            ))}
          </select>
        </div>

        {/* Area */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
            Area
          </label>
          <select
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors bg-white appearance-none"
          >
            <option value="">Select an area (optional)</option>
            {AREAS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => { setDescription(e.target.value); setError(null) }}
            placeholder="Describe the issue in detail…"
            rows={5}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-black transition-colors"
          />
        </div>

        {/* Request photos */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={requestPhotos}
            onChange={(e) => setRequestPhotos(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-gray-300 accent-black"
          />
          <span className="text-sm text-gray-700">Request photos from this clean</span>
        </label>

        <p className="text-xs text-gray-400">
          This goes directly to Laith and your assigned team manager.
        </p>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !description.trim()}
          className="w-full bg-black text-white font-semibold text-sm rounded-full py-3.5 disabled:opacity-40 hover:bg-gray-900 transition-all"
        >
          {submitting ? 'Submitting…' : 'Submit Issue'}
        </button>
      </form>
    </>
  )
}

// ── Feedback ──────────────────────────────────────────────────────────────────
function FeedbackForm({ clientId }: { clientId: string }) {
  const [rating, setRating] = useState<number | null>(null)
  const [hovered, setHovered] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) { setError('Please enter your feedback.'); return }
    setSubmitting(true)
    setError(null)
    const result = await submitClientFeedbackAction({
      client_id: clientId,
      type:      'feedback',
      message:   message.trim(),
      rating:    rating,
    })
    setSubmitting(false)
    if (result.error) { setError(result.error); return }
    setShowSuccess(true)
    setRating(null)
    setMessage('')
  }

  const displayRating = hovered ?? rating

  return (
    <>
      {showSuccess && (
        <SuccessPopup
          message="Thanks for the feedback, really appreciate it. We'll take this on board moving forward."
          onClose={() => setShowSuccess(false)}
        />
      )}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Star rating */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
            Rating (optional)
          </label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star === rating ? null : star)}
                onMouseEnter={() => setHovered(star)}
                onMouseLeave={() => setHovered(null)}
                className="text-3xl transition-transform hover:scale-110 focus:outline-none"
                aria-label={`${star} star`}
              >
                {displayRating !== null && star <= displayRating ? '★' : '☆'}
              </button>
            ))}
          </div>
          {rating !== null && (
            <p className="text-xs text-gray-400 mt-2">
              {rating === 1 ? 'Poor' : rating === 2 ? 'Fair' : rating === 3 ? 'Good' : rating === 4 ? 'Great' : 'Excellent'}
            </p>
          )}
        </div>

        {/* Feedback message */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
            Feedback
          </label>
          <textarea
            value={message}
            onChange={(e) => { setMessage(e.target.value); setError(null) }}
            placeholder="Share your thoughts…"
            rows={5}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-black transition-colors"
          />
        </div>

        <p className="text-xs text-gray-400">
          This goes directly to Laith and your assigned team leader.
        </p>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !message.trim()}
          className="w-full bg-black text-white font-semibold text-sm rounded-full py-3.5 disabled:opacity-40 hover:bg-gray-900 transition-all"
        >
          {submitting ? 'Sending…' : 'Send Feedback'}
        </button>
      </form>
    </>
  )
}

// ── Tabbed container ──────────────────────────────────────────────────────────
export function ContactForms({ clientId, recentJobs }: Props) {
  const [tab, setTab] = useState<'issue' | 'feedback'>('issue')

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-2xl mb-8 w-fit">
        {(['issue', 'feedback'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
              tab === t
                ? 'bg-white text-black shadow-sm'
                : 'text-gray-500 hover:text-black'
            }`}
          >
            {t === 'issue' ? 'Report an Issue' : 'Feedback'}
          </button>
        ))}
      </div>

      {tab === 'issue' ? (
        <ReportIssueForm clientId={clientId} recentJobs={recentJobs} />
      ) : (
        <FeedbackForm clientId={clientId} />
      )}
    </div>
  )
}
