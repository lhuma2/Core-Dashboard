'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Check, X, Loader2 } from 'lucide-react'
import { renameProposalDocAction } from '@/actions/proposal-docs'

// Renames a document's display name only. Clearing the name reverts to the original.
export function RenameDocButton({ id, name }: { id: string; name: string }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(name)
  const [busy, setBusy] = useState(false)

  async function save() {
    if (value.trim() === name) { setEditing(false); return }
    setBusy(true)
    const res = await renameProposalDocAction(id, value)
    setBusy(false)
    if (res?.error) { alert(res.error); return }
    setEditing(false); router.refresh()
  }

  if (editing) {
    return (
      <span className="flex items-center gap-1 flex-shrink-0">
        <input
          autoFocus value={value} onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setValue(name); setEditing(false) } }}
          placeholder="Document name"
          className="w-48 px-2.5 py-1 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00250e]/25"
        />
        <button onClick={save} disabled={busy} className="p-1.5 rounded-lg bg-[#003314] text-white disabled:opacity-50" title="Save name">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
        </button>
        <button onClick={() => { setValue(name); setEditing(false) }} className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600" title="Cancel">
          <X className="w-3.5 h-3.5" />
        </button>
      </span>
    )
  }

  return (
    <button
      onClick={() => { setValue(name); setEditing(true) }}
      title="Rename document"
      className="p-1.5 rounded-lg text-gray-300 hover:text-[#00250e] hover:bg-[#00250e]/5 transition-colors flex-shrink-0"
    >
      <Pencil className="w-4 h-4" />
    </button>
  )
}
