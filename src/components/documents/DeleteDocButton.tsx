'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Check, X } from 'lucide-react'
import { deleteProposalDocAction } from '@/actions/proposal-docs'

export function DeleteDocButton({ id }: { id: string }) {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  if (confirm) {
    return (
      <span className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={async () => { setBusy(true); await deleteProposalDocAction(id); router.refresh() }}
          disabled={busy}
          className="p-1.5 rounded-lg bg-red-600 text-white disabled:opacity-50"
          title="Confirm delete"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => setConfirm(false)} className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600" title="Cancel">
          <X className="w-3.5 h-3.5" />
        </button>
      </span>
    )
  }

  return (
    <button
      onClick={() => setConfirm(true)}
      title="Delete document"
      className="p-1.5 rounded-lg text-gray-300 hover:text-red-600 hover:bg-red-50 transition-colors flex-shrink-0"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  )
}
