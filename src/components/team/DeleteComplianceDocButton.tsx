'use client'

import { useState } from 'react'
import { deleteComplianceDocAction } from '@/actions/team'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

export function DeleteComplianceDocButton({ docId }: { docId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handle() {
    if (!confirm('Remove this document?')) return
    setLoading(true)
    await deleteComplianceDocAction(docId)
    router.refresh()
  }

  return (
    <button onClick={handle} disabled={loading} className="p-1.5 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50">
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  )
}
