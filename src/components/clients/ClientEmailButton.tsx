'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { sendEmailAction } from '@/actions/emails'
import { Button } from '@/components/ui/Button'
import { Send, X } from 'lucide-react'
import type { Client, EmailTemplate } from '@/types/app'

const TEMPLATE_TYPE_LABELS: Record<string, string> = {
  proposal_followup: 'Proposal Follow-Up',
  agreement_followup: 'Agreement Follow-Up',
  onboarding: 'Onboarding',
  survey: 'Survey Request',
  survey_followup: 'Survey Follow-Up',
  thankyou: 'Thank You',
  upsell: 'Upsell',
  custom: 'Custom',
}

function applyVars(text: string, client: Client) {
  return text
    .replace(/\{\{contact_name\}\}/g, client.contact_name || client.business_name || '')
    .replace(/\{\{business_name\}\}/g, client.business_name || '')
}

export function ClientEmailButton({ client }: { client: Client }) {
  const [open, setOpen] = useState(false)
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null)
  const [toEmail, setToEmail] = useState(client.contact_email || '')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!open) return
    const supabase = createClient()
    ;(supabase as any).from('email_templates').select('*').order('name').then(({ data }: any) => {
      setTemplates((data || []) as EmailTemplate[])
    })
  }, [open])

  function pickTemplate(t: EmailTemplate) {
    setSelectedTemplate(t)
    setSubject(applyVars(t.subject, client))
    setBody(applyVars(t.body, client))
  }

  async function handleSend() {
    if (!toEmail) return setError('Email address required')
    if (!subject) return setError('Subject required')
    if (!body) return setError('Body required')
    setSending(true)
    setError(null)
    const result = await sendEmailAction({
      client_id: client.id,
      to_email: toEmail,
      to_name: client.contact_name || client.business_name || '',
      subject,
      body,
      template_id: selectedTemplate?.id || null,
    })
    setSending(false)
    if (result.error) return setError(result.error)
    setSuccess(true)
    setTimeout(() => { setSuccess(false); setOpen(false) }, 2000)
  }

  const inp = 'w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900'
  const lbl = 'block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5'

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Send className="w-3.5 h-3.5" />
        Send Email
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-semibold text-gray-900">Send Email</h3>
                <p className="text-xs text-gray-400 mt-0.5">From admin@corecleaning.services → {client.business_name}</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 space-y-4">
              {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-md px-3 py-2">✓ Email sent successfully!</div>}
              {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-md px-3 py-2">{error}</div>}

              {/* Template picker */}
              {templates.length > 0 && (
                <div>
                  <label className={lbl}>Select a template (optional)</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {templates.map(t => (
                      <button key={t.id} onClick={() => pickTemplate(t)}
                        className={`text-left px-3 py-2 rounded-lg border text-xs font-medium transition ${selectedTemplate?.id === t.id ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-700 hover:border-gray-400'}`}>
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className={lbl}>To *</label>
                <input className={inp} value={toEmail} onChange={e => setToEmail(e.target.value)} placeholder="recipient@email.com" />
              </div>
              <div>
                <label className={lbl}>Subject *</label>
                <input className={inp} value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject" />
              </div>
              <div>
                <label className={lbl}>Message *</label>
                <textarea className={`${inp} min-h-[220px] resize-y leading-relaxed`} value={body} onChange={e => setBody(e.target.value)} placeholder="Write your message…" />
              </div>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
              <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleSend} disabled={sending}>
                <Send className="w-3.5 h-3.5" />
                {sending ? 'Sending…' : 'Send Email'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
