'use client'

import { useState } from 'react'
import { assignCleanerToClientAction } from '@/actions/manager'
import { UserCheck, UserX } from 'lucide-react'

interface Cleaner {
  id: string        // profiles.id (not user_id)
  full_name: string | null
}

interface Props {
  clientId: string
  currentCleanerId?: string | null
  cleaners: Cleaner[]
}

export function AssignCleanerSection({ clientId, currentCleanerId, cleaners }: Props) {
  const [selected, setSelected] = useState<string>(currentCleanerId ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const currentCleaner = cleaners.find((c) => c.id === currentCleanerId)

  async function handleAssign(cleanerId: string) {
    setSaving(true)
    setError(null)
    setSaved(false)
    const result = await assignCleanerToClientAction(clientId, cleanerId || null)
    setSaving(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setSelected(cleanerId)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function handleUnassign() {
    await handleAssign('')
  }

  return (
    <section className="mb-8">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
        Assign Cleaner
      </p>

      {/* Current assignment banner */}
      {selected ? (
        <div className="bg-black rounded-2xl px-5 py-4 flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <UserCheck className="w-4 h-4 text-white flex-shrink-0" />
            <div>
              <p className="text-[10px] text-gray-300 font-medium uppercase tracking-widest">Assigned</p>
              <p className="text-sm font-semibold text-white">
                {cleaners.find((c) => c.id === selected)?.full_name ?? '—'}
              </p>
            </div>
          </div>
          <button
            onClick={handleUnassign}
            disabled={saving}
            className="text-xs font-semibold text-gray-300 border border-gray-600 px-3 py-1.5 rounded-full hover:border-white hover:text-white transition-colors disabled:opacity-40"
          >
            Unassign
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl px-5 py-4 flex items-center gap-3 mb-3 border border-dashed border-gray-300">
          <UserX className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <p className="text-sm text-gray-500">No cleaner assigned yet</p>
        </div>
      )}

      {/* Cleaner picker */}
      {cleaners.length === 0 ? (
        <p className="text-xs text-gray-400 px-1">No cleaners in the system yet. Add cleaner accounts from the Team page.</p>
      ) : (
        <div className="space-y-2">
          {cleaners.map((cleaner) => {
            const isSelected = selected === cleaner.id
            return (
              <button
                key={cleaner.id}
                onClick={() => !isSelected && handleAssign(cleaner.id)}
                disabled={saving || isSelected}
                className={`w-full text-left bg-white rounded-2xl px-5 py-4 flex items-center justify-between gap-3 transition-colors border ${
                  isSelected
                    ? 'border-black bg-gray-50'
                    : 'border-transparent hover:border-gray-300 active:bg-gray-50'
                } disabled:cursor-default`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isSelected ? 'bg-black' : 'bg-gray-100'
                  }`}>
                    <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-gray-500'}`}>
                      {(cleaner.full_name ?? '?')[0].toUpperCase()}
                    </span>
                  </div>
                  <p className={`text-sm font-medium ${isSelected ? 'text-black' : 'text-gray-700'}`}>
                    {cleaner.full_name ?? 'Unnamed'}
                  </p>
                </div>
                {isSelected && (
                  <span className="text-[11px] font-semibold text-black bg-gray-100 px-2.5 py-1 rounded-full">
                    Assigned
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {saved && (
        <p className="text-xs text-gray-500 mt-3 px-1">✓ Saved</p>
      )}
      {error && (
        <p className="text-xs text-red-500 mt-3 px-1">{error}</p>
      )}
    </section>
  )
}
