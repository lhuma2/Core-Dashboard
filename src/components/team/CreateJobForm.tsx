'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createJobAction } from '@/actions/team'

interface Cleaner { id: string; full_name: string | null }
interface Client  { id: string; business_name: string; address?: string | null; suburb?: string | null; frequency?: string | null }

export function CreateJobForm({ cleaners, clients }: { cleaners: Cleaner[]; clients: Client[] }) {
  const router = useRouter()
  const [clientId, setClientId] = useState('')
  const [cleanerId, setCleanerId] = useState('')
  const [date, setDate] = useState('')
  const [accessNotes, setAccessNotes] = useState('')
  const [checklist, setChecklist] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const selectedClient = clients.find((c) => c.id === clientId)

  const inp = 'w-full bg-white border border-gray-200 text-gray-900 text-sm rounded-lg px-3 py-2.5 placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors'
  const lbl = 'block text-xs font-medium text-gray-600 mb-1.5'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clientId || !date) return setError('Client and date are required')
    setSubmitting(true)
    setError(null)

    // Parse checklist items (one per line)
    const checklistItems = checklist
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((label, i) => ({ id: `item_${i}`, label, required: true }))

    const result = await createJobAction({
      clientId,
      cleanerId:    cleanerId || null,
      scheduledDate: date,
      address: selectedClient
        ? [selectedClient.address, selectedClient.suburb].filter(Boolean).join(', ')
        : '',
      accessNotes:    accessNotes.trim() || null,
      frequencyLabel: selectedClient?.frequency ?? null,
      checklist:      checklistItems,
    })
    setSubmitting(false)
    if (result.error) return setError(result.error)
    setSuccess(true)
    setClientId(''); setCleanerId(''); setDate(''); setAccessNotes(''); setChecklist('')
    router.refresh()
    setTimeout(() => setSuccess(false), 3000)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {success && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg px-3 py-2.5">✓ Job created</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg px-3 py-2.5">{error}</div>}

      <div>
        <label className={lbl}>Client *</label>
        <select className={inp} value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">Select client…</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.business_name}</option>)}
        </select>
      </div>

      <div>
        <label className={lbl}>Assign Cleaner</label>
        <select className={inp} value={cleanerId} onChange={(e) => setCleanerId(e.target.value)}>
          <option value="">Unassigned</option>
          {cleaners.map((c) => <option key={c.id} value={c.id}>{c.full_name ?? c.id}</option>)}
        </select>
      </div>

      <div>
        <label className={lbl}>Scheduled Date *</label>
        <input className={inp} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <div>
        <label className={lbl}>Access Notes / Codes</label>
        <textarea className={inp} rows={2} value={accessNotes} onChange={(e) => setAccessNotes(e.target.value)} placeholder="Entry code: 1234, alarm pin: 0000…" />
      </div>

      <div>
        <label className={lbl}>Checklist Items <span className="text-gray-400">(one per line)</span></label>
        <textarea className={inp} rows={4} value={checklist} onChange={(e) => setChecklist(e.target.value)} placeholder="Vacuum all floors&#10;Clean bathrooms&#10;Empty bins&#10;Mop hard floors" />
      </div>

      <button type="submit" disabled={submitting} className="w-full bg-[#003314] hover:bg-[#00250e] text-white text-sm font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 mt-1">
        {submitting ? 'Creating…' : 'Create Job'}
      </button>
    </form>
  )
}
