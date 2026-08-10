'use client'

import { useState, useTransition } from 'react'
import { Pencil, Check, X } from 'lucide-react'

export function CleanerCostEditor({ jobId, initialCost, updateAction }: {
  jobId: string
  initialCost: number | null
  updateAction: (id: string, cost: number | null) => Promise<{ error?: string; success?: boolean }>
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(initialCost != null ? String(initialCost) : '')
  const [saved, setSaved] = useState(initialCost)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function save() {
    const parsed = value.trim() === '' ? null : Number(value)
    if (parsed != null && (Number.isNaN(parsed) || parsed < 0)) {
      setError('Enter a valid amount')
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await updateAction(jobId, parsed)
      if (res?.error) { setError(res.error); return }
      setSaved(parsed)
      setEditing(false)
    })
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => { setValue(saved != null ? String(saved) : ''); setEditing(true) }}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-black hover:text-gray-600 transition"
      >
        {saved != null ? `$${Number(saved).toFixed(2)}` : 'Not set'}
        <Pencil className="w-3 h-3 text-gray-400" />
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        step="0.01"
        min="0"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
        className="w-24 text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-[#00250e]"
        disabled={isPending}
      />
      <button type="button" onClick={save} disabled={isPending} className="p-1 rounded-lg text-green-600 hover:bg-green-50 disabled:opacity-50">
        <Check className="w-4 h-4" />
      </button>
      <button type="button" onClick={() => setEditing(false)} disabled={isPending} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100">
        <X className="w-4 h-4" />
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
