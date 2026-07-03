'use client'

import { useState } from 'react'
import { PenLine, Loader2 } from 'lucide-react'
import { createAgreementForClientAction } from '@/actions/proposal-docs'

// Creates a service agreement already linked to this client (prefilled with their
// name/details) and opens the editor. When signed, it lands on their profile.
export function NewAgreementButton({ clientId }: { clientId: string }) {
  const [busy, setBusy] = useState(false)
  return (
    <button
      onClick={() => { setBusy(true); createAgreementForClientAction(clientId) }}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-lg bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-xs font-semibold px-3 py-2 transition-colors disabled:opacity-50"
    >
      {busy ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating…</> : <><PenLine className="w-3.5 h-3.5" /> New agreement</>}
    </button>
  )
}
