'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Share2, Mail, Trash2, Loader2, Check } from 'lucide-react'
import { shareInspectionAction, notifySubcontractorAction, deleteInspectionAction } from '@/actions/inspections'

export function InspectionActions({ id, shared, hasFixes }: { id: string; shared: boolean; hasFixes: boolean }) {
  const router = useRouter()
  const [isShared, setIsShared] = useState(shared)
  const [busy, setBusy] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function toggleShare() {
    setBusy('share'); setMsg(null)
    const next = !isShared
    const res = await shareInspectionAction(id, next)
    setBusy(null)
    if (res?.error) { setMsg(res.error); return }
    setIsShared(next)
    router.refresh()
  }

  async function notify() {
    setBusy('notify'); setMsg(null)
    const res = await notifySubcontractorAction(id)
    setBusy(null)
    if (res?.error) { setMsg(res.error); return }
    setSent(true); setTimeout(() => setSent(false), 3000)
  }

  async function remove() {
    if (!confirm('Delete this inspection? This cannot be undone.')) return
    setBusy('delete')
    const res = await deleteInspectionAction(id)
    if (res?.error) { setBusy(null); setMsg(res.error); return }
    router.push('/inspections')
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5"><Share2 className="w-4 h-4 text-[#1e3a5f]" /> Share with client</p>
          <p className="text-xs text-gray-400 mt-0.5">{isShared ? 'Visible in the client’s portal.' : 'Only you can see this inspection.'}</p>
        </div>
        <button onClick={toggleShare} disabled={busy === 'share'} role="switch" aria-checked={isShared}
          className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${isShared ? 'bg-emerald-500' : 'bg-gray-200'} disabled:opacity-50`}>
          <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${isShared ? 'translate-x-5' : ''}`} />
        </button>
      </div>

      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
        {hasFixes && (
          <button onClick={notify} disabled={busy === 'notify'}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-[#1e3a5f] hover:bg-[#162d4a] rounded-xl px-4 py-2.5 disabled:opacity-50 transition-colors">
            {busy === 'notify' ? <Loader2 className="w-4 h-4 animate-spin" /> : sent ? <Check className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
            {sent ? 'Sent to subcontractor' : 'Email fix-list to subcontractor'}
          </button>
        )}
        <button onClick={remove} disabled={busy === 'delete'}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-red-500 hover:bg-red-50 rounded-xl px-3 py-2.5 disabled:opacity-50 transition-colors ml-auto">
          <Trash2 className="w-4 h-4" /> Delete
        </button>
      </div>
      {msg && <p className="text-xs text-red-600 mt-3">{msg}</p>}
    </div>
  )
}
