'use client'

import { useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { createClientFromAgreementAction, dismissAgreementPromptAction } from '@/actions/welcome'

export function CreateClientFromAgreementButton({ docId }: { docId: string }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  return (
    <>
      {err && <span className="text-xs text-red-500">{err}</span>}
      <button
        onClick={async () => {
          setBusy(true); setErr(null)
          try {
            const res = await createClientFromAgreementAction(docId)
            if (res?.error) setErr(res.error)
          } catch (e: any) {
            if (!String(e?.digest ?? '').startsWith('NEXT_REDIRECT')) setErr('Could not create the client.')
          }
          setBusy(false)
        }}
        disabled={busy}
        className="inline-flex items-center gap-1 text-xs font-semibold bg-[#003314] hover:bg-[#00250e] text-white rounded-lg px-3 py-1.5 disabled:opacity-50"
      >
        {busy && <Loader2 className="w-3 h-3 animate-spin" />} Create client
      </button>
    </>
  )
}

export function DismissAgreementPromptButton({ docId }: { docId: string }) {
  const [busy, setBusy] = useState(false)
  return (
    <button
      onClick={async () => { setBusy(true); await dismissAgreementPromptAction(docId); setBusy(false) }}
      disabled={busy}
      title="Dismiss"
      className="text-gray-400 hover:text-gray-700 disabled:opacity-50"
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
    </button>
  )
}
