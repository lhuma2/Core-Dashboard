'use client'

import { useState } from 'react'
import { Clock, Send } from 'lucide-react'
import { sendSurveyReminderAction } from '@/actions/survey-email'

interface PendingToken {
  id: string
  created_at: string
  clients: {
    business_name: string
    contact_name: string | null
    contact_email: string | null
  } | null
}

function daysAgo(dateStr: string) {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

function ReminderButton({ tokenId }: { tokenId: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function send() {
    setState('sending')
    const result = await sendSurveyReminderAction(tokenId)
    setState(result.success ? 'sent' : 'error')
  }

  if (state === 'sent') return <span className="text-xs font-medium text-emerald-600">Reminder sent ✓</span>
  if (state === 'error') return <span className="text-xs font-medium text-red-500">Failed — try again</span>

  return (
    <button
      onClick={send}
      disabled={state === 'sending'}
      className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-brand-navy border border-gray-200 hover:border-brand-navy px-3 py-1.5 rounded-lg transition disabled:opacity-50"
    >
      <Send className="w-3.5 h-3.5" />
      {state === 'sending' ? 'Sending…' : 'Send Reminder'}
    </button>
  )
}

export function PendingSurveys({ pending }: { pending: PendingToken[] }) {
  return (
    <div className="bg-white border border-amber-200 rounded-xl overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-amber-100 bg-amber-50">
        <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
        <h3 className="text-sm font-semibold text-amber-800">
          Awaiting Response — {pending.length} survey{pending.length !== 1 ? 's' : ''} not yet completed
        </h3>
      </div>
      <div className="divide-y divide-gray-100">
        {pending.map((token) => (
          <div key={token.id} className="flex items-center justify-between gap-3 px-5 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {token.clients?.business_name || 'Unknown Client'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {token.clients?.contact_name && `${token.clients.contact_name} · `}
                Sent {daysAgo(token.created_at)}
                {token.clients?.contact_email && ` · ${token.clients.contact_email}`}
              </p>
            </div>
            <ReminderButton tokenId={token.id} />
          </div>
        ))}
      </div>
    </div>
  )
}
