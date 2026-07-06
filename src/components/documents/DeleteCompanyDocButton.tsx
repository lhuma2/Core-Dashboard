'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { deleteCompanyDocumentAction } from '@/actions/company-docs'
import { Trash2, Loader2 } from 'lucide-react'

export function DeleteCompanyDocButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()

  function armOrConfirm() {
    if (!confirming) {
      setConfirming(true)
      // auto-reset if they don't confirm within a few seconds
      timer.current = setTimeout(() => setConfirming(false), 3500)
      return
    }
    if (timer.current) clearTimeout(timer.current)
    setBusy(true)
    deleteCompanyDocumentAction(id).then((res) => {
      if (res?.error) { alert(res.error); setBusy(false); setConfirming(false); return }
      router.refresh()
    })
  }

  return (
    <button
      type="button"
      onClick={armOrConfirm}
      disabled={busy}
      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-full px-4 py-1.5 transition-colors flex-shrink-0 border ${
        confirming
          ? 'bg-red-500 text-white border-red-500 hover:bg-red-600'
          : 'text-red-500 border-red-200 hover:bg-red-50'
      }`}
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
      {busy ? 'Removing…' : confirming ? 'Confirm removal' : 'Remove'}
    </button>
  )
}
