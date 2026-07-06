'use client'

import { useState } from 'react'
import { linkClientToUserAction } from '@/actions/team'
import { Link2 } from 'lucide-react'

interface Client {
  id: string
  business_name: string
}

interface Props {
  profileId: string
  currentClientId?: string | null
  currentClientName?: string | null
  clients: Client[]
}

export function LinkClientButton({ profileId, currentClientId, currentClientName, clients }: Props) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(currentClientId ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    const result = await linkClientToUserAction(profileId, selected || null)
    setSaving(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setOpen(false)
    window.location.reload()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title={currentClientName ? `Linked: ${currentClientName}` : 'Link to client'}
        className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${
          currentClientId
            ? 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
            : 'border-gray-200 text-gray-500 bg-white hover:border-gray-400'
        }`}
      >
        <Link2 className="w-3 h-3" />
        {currentClientName ? currentClientName : 'Link client'}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500"
        autoFocus
      >
        <option value="">No client</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>{c.business_name}</option>
        ))}
      </select>
      <button
        onClick={handleSave}
        disabled={saving}
        className="text-xs font-semibold bg-[#00250e] text-white px-2.5 py-1.5 rounded-lg hover:bg-[#001a09] disabled:opacity-50"
      >
        {saving ? '…' : 'Save'}
      </button>
      <button
        onClick={() => { setOpen(false); setSelected(currentClientId ?? '') }}
        className="text-xs text-gray-400 hover:text-gray-600"
      >
        Cancel
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
