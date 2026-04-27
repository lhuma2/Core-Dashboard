'use client'

import { useState } from 'react'
import { sendSurveyEmailAction } from '@/actions/survey-email'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Send, CheckCircle } from 'lucide-react'

export function SendSurveyButton({
  clientId,
  clientEmail,
  contactName,
}: {
  clientId: string
  clientEmail?: string | null
  contactName?: string | null
}) {
  const [sending, setSending]       = useState(false)
  const [done, setDone]             = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  async function handleSend() {
    setSending(true)
    setError(null)
    const result = await sendSurveyEmailAction(clientId)
    setSending(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setDone(true)
    setShowConfirm(false)
    setTimeout(() => setDone(false), 4000)
  }

  if (!clientEmail) {
    return (
      <Button variant="secondary" size="sm" disabled title="No email address on file">
        <Send className="w-3.5 h-3.5" />
        Send Survey
      </Button>
    )
  }

  if (done) {
    return (
      <Button variant="secondary" size="sm" disabled>
        <CheckCircle className="w-3.5 h-3.5 text-green-500" />
        Survey Sent
      </Button>
    )
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setShowConfirm(true)} disabled={sending}>
        <Send className="w-3.5 h-3.5" />
        Send Survey
      </Button>

      <Modal
        open={showConfirm}
        onOpenChange={(o) => { if (!o) setShowConfirm(false) }}
        title="Send satisfaction survey?"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            A personalised survey link will be sent to:
          </p>

          <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3">
            <p className="text-sm font-medium text-gray-900">{contactName || 'Contact'}</p>
            <p className="text-sm text-brand-navy mt-0.5">{clientEmail}</p>
          </div>

          <p className="text-xs text-gray-400">
            The link is unique and single-use. Results appear automatically in the client profile once submitted.
          </p>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              variant="secondary"
              onClick={() => setShowConfirm(false)}
              className="flex-1"
              disabled={sending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={sending}
              className="flex-1"
            >
              <Send className="w-3.5 h-3.5" />
              {sending ? 'Sending…' : 'Send Survey'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
