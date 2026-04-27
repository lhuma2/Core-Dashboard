'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createJobAction } from '@/actions/team'

interface Client {
  id: string
  business_name: string
  address?: string | null
  suburb?: string | null
  frequency?: string | null
}

interface Cleaner {
  id: string
  fullName: string
}

interface Props {
  clients: Client[]
  cleaners: Cleaner[]
}

export function ManagerCreateJobForm({ clients, cleaners }: Props) {
  const router = useRouter()
  const [clientId, setClientId] = useState('')
  const [cleanerId, setCleanerId] = useState('')
  const [date, setDate] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sel = 'w-full border-b border-gray-200 py-2.5 text-sm text-black focus:outline-none focus:border-black transition-colors bg-transparent'
  const inp = 'w-full border-b border-gray-200 py-2.5 text-sm text-black focus:outline-none focus:border-black transition-colors bg-transparent placeholder-gray-400'

  function handleClientChange(id: string) {
    setClientId(id)
    const client = clients.find((c) => c.id === id)
    if (client) {
      const addr = [client.address, client.suburb].filter(Boolean).join(', ')
      if (addr) setAddress(addr)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clientId || !date) return setError('Client and date are required')
    setSaving(true)
    setError(null)

    const selectedClient = clients.find((c) => c.id === clientId)
    const result = await createJobAction({
      clientId,
      cleanerId: cleanerId || null,
      scheduledDate: date,
      address: address.trim(),
      accessNotes: notes.trim() || null,
      frequencyLabel: selectedClient?.frequency ?? null,
      checklist: [],
    })
    setSaving(false)
    if (result.error) return setError(result.error)
    setSuccess(true)
    setClientId(''); setCleanerId(''); setDate(''); setAddress(''); setNotes('')
    router.refresh()
    setTimeout(() => setSuccess(false), 2500)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {success && <p className="text-xs text-green-700 font-medium">✓ Job created</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}

      <div>
        <p className="text-xs text-gray-400 mb-1.5">Client</p>
        <select className={sel} value={clientId} onChange={(e) => handleClientChange(e.target.value)}>
          <option value="">Select client…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.business_name}</option>
          ))}
        </select>
      </div>

      <div>
        <p className="text-xs text-gray-400 mb-1.5">Assign Cleaner</p>
        <select className={sel} value={cleanerId} onChange={(e) => setCleanerId(e.target.value)}>
          <option value="">Unassigned</option>
          {cleaners.map((c) => (
            <option key={c.id} value={c.id}>{c.fullName}</option>
          ))}
        </select>
      </div>

      <div>
        <p className="text-xs text-gray-400 mb-1.5">Date</p>
        <input
          className={inp}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </div>

      <div>
        <p className="text-xs text-gray-400 mb-1.5">Address</p>
        <input
          className={inp}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="123 Main St, Suburb"
        />
      </div>

      <div>
        <p className="text-xs text-gray-400 mb-1.5">Access Notes (optional)</p>
        <input
          className={inp}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Entry codes, alarm pin…"
        />
      </div>

      <button
        type="submit"
        disabled={saving || !clientId || !date}
        className="w-full bg-black text-white text-sm font-semibold rounded-2xl py-3.5 disabled:opacity-40 active:scale-[0.98] transition-all"
      >
        {saving ? 'Creating…' : 'Create Job'}
      </button>
    </form>
  )
}
