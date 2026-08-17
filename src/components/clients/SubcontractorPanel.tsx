'use client'

import { useState } from 'react'
import { Check, Copy, Loader2, ShieldCheck, AlertTriangle, ExternalLink, Trash2, Plus } from 'lucide-react'
import { createSubcontractorLinkAction, deleteSubcontractorLinkAction } from '@/actions/subcontractor'

interface Sub {
  id: string
  company_name: string | null
  abn: string | null
  contact_name: string | null
  contact_email: string | null
  insurance_expiry: string | null
  sign_code: string | null
  signed_at: string | null
  signed_name: string | null
}

function expiryInfo(dateStr: string | null): { label: string; cls: string; days: number | null } {
  if (!dateStr) return { label: 'Not recorded', cls: 'text-gray-400', days: null }
  const days = Math.ceil((new Date(dateStr + 'T00:00:00').getTime() - Date.now()) / 86_400_000)
  const label = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  if (days < 0) return { label: `${label} · expired`, cls: 'text-red-600', days }
  if (days <= 30) return { label: `${label} · ${days}d`, cls: 'text-red-600', days }
  if (days <= 60) return { label: `${label} · ${days}d`, cls: 'text-amber-600', days }
  return { label, cls: 'text-gray-800', days }
}

function SubRow({ sub, onDelete }: { sub: Sub; onDelete: (id: string) => void }) {
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const signed = !!sub.signed_at
  const ins = expiryInfo(sub.insurance_expiry)
  const link = `https://portal.corecleaning.services/onboard/${sub.sign_code}`

  function copy() {
    navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }).catch(() => {})
  }

  async function handleDelete() {
    if (!confirm('Remove this onboarding link? This cannot be undone.')) return
    setBusy(true)
    const res = await deleteSubcontractorLinkAction(sub.id)
    setBusy(false)
    if (!('error' in res)) onDelete(sub.id)
  }

  return (
    <div className="border border-gray-100 rounded-xl px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {signed ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900 truncate">{sub.company_name || 'Unnamed subcontractor'}</span>
                {sub.abn && <span className="text-xs text-gray-400">ABN {sub.abn}</span>}
                <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5 flex-shrink-0">Onboarded</span>
              </div>
              <p className="text-xs text-gray-500">Signed by {sub.signed_name} · {new Date(sub.signed_at!).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Australia/Brisbane' })}</p>
              <p className={`text-xs flex items-center gap-1 ${ins.cls}`}>
                {ins.days != null && ins.days <= 60 && <AlertTriangle className="w-3 h-3" />}
                Insurance: {ins.label}
              </p>
              <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-[#00250e] hover:underline mt-0.5">
                <ExternalLink className="w-3.5 h-3.5" /> Open signed pack
              </a>
            </div>
          ) : (
            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">Awaiting signature</span>
              <div className="flex items-center gap-2 rounded-lg bg-gray-50 border border-gray-200 px-3 py-1.5">
                <span className="text-xs text-gray-500 truncate flex-1">{link}</span>
                <button onClick={copy} className="text-xs font-semibold text-[#00250e] inline-flex items-center gap-1 flex-shrink-0">
                  {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                </button>
              </div>
            </div>
          )}
        </div>
        <button onClick={handleDelete} disabled={busy} className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0" aria-label="Remove">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

export function SubcontractorPanel({ subs: initialSubs }: { subs: Sub[] }) {
  const [subs, setSubs] = useState(initialSubs)
  const [busy, setBusy] = useState(false)

  async function makeLink() {
    setBusy(true)
    const res = await createSubcontractorLinkAction()
    setBusy(false)
    if ('code' in res) {
      setSubs((prev) => [{ id: crypto.randomUUID(), company_name: null, abn: null, contact_name: null, contact_email: null, insurance_expiry: null, sign_code: res.code, signed_at: null, signed_name: null }, ...prev])
      navigator.clipboard?.writeText(res.link).catch(() => {})
    }
  }

  function handleDelete(id: string) {
    setSubs((prev) => prev.filter((s) => s.id !== id))
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-8">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#00250e]" />
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Subcontractors · {subs.length}</p>
        </div>
        <button onClick={makeLink} disabled={busy}
          className="inline-flex items-center gap-1.5 bg-[#003314] hover:bg-[#00250e] text-white text-xs font-semibold rounded-lg px-3 py-1.5 disabled:opacity-50 transition-colors flex-shrink-0">
          {busy ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating…</> : <><Plus className="w-3.5 h-3.5" /> New onboarding link</>}
        </button>
      </div>

      {subs.length === 0 ? (
        <p className="text-sm text-gray-500">No subcontractors onboarded yet. Create a secure link per cleaner/subcontractor — each one reviews the whole pack, adds their details, and signs once.</p>
      ) : (
        <div className="space-y-2">
          {subs.map((s) => <SubRow key={s.id} sub={s} onDelete={handleDelete} />)}
        </div>
      )}
    </div>
  )
}
