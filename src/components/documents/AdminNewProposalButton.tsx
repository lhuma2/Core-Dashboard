'use client'

import { useState, useRef, useEffect } from 'react'
import { Loader2, FileText, ChevronDown, ShieldCheck } from 'lucide-react'
import { createProposalFromDocAction } from '@/actions/proposal-docs'

type Doc = { name: string; url: string }

export function AdminNewProposalButton({ docs = [] }: { docs?: Doc[] }) {
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        className="inline-flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 text-sm font-semibold rounded-xl px-4 py-2.5 shadow-[0_1px_2px_rgba(16,24,40,0.05)] active:scale-[0.98] transition-all disabled:opacity-60"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Admin new proposal
        <ChevronDown className="w-3.5 h-3.5 opacity-80" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl border border-gray-200 shadow-lg py-1.5 z-30">
          <p className="px-3 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Select a document to fill in
          </p>
          <div className="max-h-72 overflow-y-auto">
            {docs.length === 0 && (
              <p className="px-3 py-2 text-xs text-gray-400">No company documents yet — upload one below first.</p>
            )}
            {docs.map((d) => (
              <button
                key={d.url}
                onClick={() => { setOpen(false); setBusy(true); createProposalFromDocAction(d.name, d.url) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
              >
                <FileText className="w-4 h-4 text-[#00250e] flex-shrink-0" />
                <span className="truncate">{d.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
