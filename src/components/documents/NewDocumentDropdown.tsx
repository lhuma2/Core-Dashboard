'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, ChevronDown, FileText, FileSignature, Wrench } from 'lucide-react'

const OPTIONS = [
  { type: 'proposal',             label: 'Proposal',             sub: 'Pre-sale quote',         icon: FileText },
  { type: 'cleaning_agreement',   label: 'Agreement',            sub: 'Ongoing service contract', icon: FileSignature },
  { type: 'specialist_agreement', label: 'Specialist Agreement', sub: 'One-off or specialist job', icon: Wrench },
] as const

export function NewDocumentDropdown({ clientId }: { clientId?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function navigate(type: string) {
    setOpen(false)
    const params = new URLSearchParams({ type })
    if (clientId) params.set('client', clientId)
    router.push(`/documents/new?${params.toString()}`)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 px-3.5 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
      >
        <Plus className="w-4 h-4" />
        New Document
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-56 bg-white rounded-xl border border-gray-100 shadow-lg z-50 overflow-hidden py-1">
          {OPTIONS.map(({ type, label, sub, icon: Icon }) => (
            <button
              key={type}
              onClick={() => navigate(type)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Icon className="w-3.5 h-3.5 text-gray-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{label}</p>
                <p className="text-xs text-gray-400">{sub}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
