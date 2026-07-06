'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteCompanyDocumentAction } from '@/actions/company-docs'
import { Trash2, Loader2 } from 'lucide-react'

export function DeleteCompanyDocButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false)
  const router = useRouter()
  async function onDelete() {
    if (!confirm('Remove this company document?')) return
    setBusy(true)
    const res = await deleteCompanyDocumentAction(id)
    if (res?.error) { alert(res.error); setBusy(false); return }
    router.refresh()
  }
  return (
    <button type="button" onClick={onDelete} disabled={busy} aria-label="Delete document"
      className="p-1.5 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
    </button>
  )
}
