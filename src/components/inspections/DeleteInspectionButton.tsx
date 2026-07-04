'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2 } from 'lucide-react'
import { deleteInspectionAction } from '@/actions/inspections'

export function DeleteInspectionButton({ id }: { id: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function del(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Delete this inspection? This cannot be undone.')) return
    setBusy(true)
    const res = await deleteInspectionAction(id)
    if (res?.error) { setBusy(false); alert(res.error); return }
    router.refresh()
  }

  return (
    <button onClick={del} disabled={busy} aria-label="Delete inspection"
      className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50">
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
    </button>
  )
}
