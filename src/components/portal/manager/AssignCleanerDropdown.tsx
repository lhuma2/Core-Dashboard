'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { assignCleanerToClientAction } from '@/actions/manager'

interface Props {
  clientId: string
  currentCleanerId: string | null
  cleaners: { id: string; full_name: string | null }[]
}

export function AssignCleanerDropdown({ clientId, currentCleanerId, cleaners }: Props) {
  const router = useRouter()
  const [value, setValue] = useState(currentCleanerId ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleChange(newId: string) {
    setValue(newId)
    setSaving(true)
    setSaved(false)
    await assignCleanerToClientAction(clientId, newId || null)
    setSaving(false)
    setSaved(true)
    router.refresh()
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="bg-white rounded-2xl px-5 py-4 mb-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Assign Cleaner</p>
      <select
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        disabled={saving}
        className="w-full border-b border-gray-200 py-2.5 text-sm text-black focus:outline-none focus:border-black transition-colors bg-transparent disabled:opacity-50"
      >
        <option value="">Unassigned</option>
        {cleaners.map((c) => (
          <option key={c.id} value={c.id}>{c.full_name ?? c.id}</option>
        ))}
      </select>
      {saved && <p className="text-xs text-green-600 mt-2">✓ Saved</p>}
    </div>
  )
}
