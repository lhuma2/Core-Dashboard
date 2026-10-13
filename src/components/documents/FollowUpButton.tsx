'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Phone, X, Loader2, Check } from 'lucide-react'
import { logFollowUpAction } from '@/actions/follow-ups'
import { FOLLOW_UP_OUTCOME_LABELS, shortDate, telHref, type FollowUpOutcome, type FollowUpState } from '@/lib/documents/follow-up'

// "Follow up" on a sent quote: shows on the day the next call is due, prompts
// the call with the client's number, then logs how it went.
export function FollowUpButton({ id, clientName, phone, state, compact }: {
  id: string
  clientName: string
  phone: string
  state: FollowUpState
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)

  if (!state.dueDate) {
    return compact ? null : <span className="text-[11px] text-gray-400">Follow-up calls done</span>
  }
  if (!state.due) {
    return <span className="text-[11px] text-gray-400 whitespace-nowrap">Call {shortDate(state.dueDate)}</span>
  }
  return (
    <>
      <button onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-3 py-1.5 whitespace-nowrap">
        <Phone className="w-3.5 h-3.5" /> Follow up
      </button>
      {open && <FollowUpModal id={id} clientName={clientName} phone={phone} state={state} onClose={() => setOpen(false)} />}
    </>
  )
}

function FollowUpModal({ id, clientName, phone, state, onClose }: {
  id: string; clientName: string; phone: string; state: FollowUpState; onClose: () => void
}) {
  const router = useRouter()
  const [number, setNumber] = useState(phone)
  const [busy, setBusy] = useState<FollowUpOutcome | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const hasNumber = number.replace(/\D/g, '').length >= 6

  async function log(outcome: FollowUpOutcome) {
    setErr(null); setBusy(outcome)
    const res = await logFollowUpAction(id, outcome, number !== phone ? number : undefined)
    setBusy(null)
    if (res?.error) { setErr(res.error); return }
    onClose()
    router.refresh()
  }

  const lastCall = state.last
    ? `Last call ${new Date(state.last.at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'Australia/Brisbane' })}: ${FOLLOW_UP_OUTCOME_LABELS[state.last.outcome].toLowerCase()}.`
    : 'You called them before sending, so this is the first follow-up since.'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Follow up with {clientName || 'the client'}</h3>
            <p className="text-[11px] text-gray-400">Call {state.step} of {state.total}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-gray-500 leading-relaxed">{lastCall} Give them a call about their quote.</p>
          {hasNumber && (
            <a href={telHref(number)}
              className="flex items-center justify-center gap-2 w-full bg-[#003314] hover:bg-[#00250e] text-white text-base font-bold rounded-xl px-4 py-3.5">
              <Phone className="w-4 h-4" /> Call {number}
            </a>
          )}
          <label className="block space-y-1">
            <span className="text-[11px] font-semibold text-gray-500">{hasNumber ? 'Number' : 'No number on the quote. Add one:'}</span>
            <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="04XX XXX XXX" inputMode="tel"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#00250e]/25 focus:border-[#00250e]" />
          </label>
          <div className="space-y-2 pt-1">
            <p className="text-[11px] font-semibold text-gray-500">How did it go?</p>
            {(Object.keys(FOLLOW_UP_OUTCOME_LABELS) as FollowUpOutcome[]).map((o) => (
              <button key={o} onClick={() => log(o)} disabled={!!busy}
                className={`w-full flex items-center justify-between gap-2 text-sm font-medium border rounded-lg px-3 py-2.5 disabled:opacity-60 ${o === 'not_going_ahead' ? 'border-red-200 text-red-700 hover:bg-red-50' : 'border-gray-200 text-gray-800 hover:bg-gray-50'}`}>
                {FOLLOW_UP_OUTCOME_LABELS[o]}
                {busy === o ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 text-gray-300" />}
              </button>
            ))}
            <p className="text-[11px] text-gray-400 leading-snug">
              {state.step < state.total ? 'The next follow-up is scheduled from today.' : 'This is the last scheduled follow-up.'} &ldquo;Not going ahead&rdquo; stops the reminders and marks the quote declined.
            </p>
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
        </div>
      </div>
    </div>
  )
}
