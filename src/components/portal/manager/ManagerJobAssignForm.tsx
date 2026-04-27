'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { assignCleanerToJobAction } from '@/actions/jobs'

interface Job {
  id: string
  clientName: string
  scheduledDate: string
  currentCleanerId: string | null
}

interface Cleaner {
  id: string
  fullName: string
}

interface Props {
  jobs: Job[]
  cleaners: Cleaner[]
}

export function ManagerJobAssignForm({ jobs, cleaners }: Props) {
  const router = useRouter()
  const [jobId, setJobId] = useState('')
  const [cleanerId, setCleanerId] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sel = 'w-full border-b border-gray-200 py-2.5 text-sm text-black focus:outline-none focus:border-black transition-colors bg-transparent'

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault()
    if (!jobId) return setError('Select a job')
    setSaving(true)
    const result = await assignCleanerToJobAction(jobId, cleanerId || null)
    setSaving(false)
    if (result.error) return setError(result.error)
    setSuccess(true); setJobId(''); setCleanerId('')
    router.refresh()
    setTimeout(() => setSuccess(false), 2500)
  }

  return (
    <form onSubmit={handleAssign} className="space-y-4">
      {success && <p className="text-xs text-green-700 font-medium">✓ Assignment updated</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}

      <div>
        <p className="text-xs text-gray-400 mb-1.5">Job</p>
        <select className={sel} value={jobId} onChange={(e) => { setJobId(e.target.value); setError(null) }}>
          <option value="">Select job…</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.clientName} · {new Date(j.scheduledDate + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
            </option>
          ))}
        </select>
      </div>

      <div>
        <p className="text-xs text-gray-400 mb-1.5">Assign To</p>
        <select className={sel} value={cleanerId} onChange={(e) => setCleanerId(e.target.value)}>
          <option value="">Unassigned</option>
          {cleaners.map((c) => (
            <option key={c.id} value={c.id}>{c.fullName}</option>
          ))}
        </select>
      </div>

      <button type="submit" disabled={saving || !jobId}
        className="w-full bg-black text-white text-sm font-semibold rounded-2xl py-3.5 disabled:opacity-40 active:scale-[0.98] transition-all">
        {saving ? 'Saving…' : 'Update Assignment'}
      </button>
    </form>
  )
}
