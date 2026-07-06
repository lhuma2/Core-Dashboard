'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { sendEmailAction } from '@/actions/emails'
import { Button } from '@/components/ui/Button'
import { Send, X } from 'lucide-react'
import type { Document, EmailTemplate } from '@/types/app'

function applyVars(text: string, vars: Record<string, string>) {
  return Object.entries(vars).reduce((t, [k, v]) => t.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v), text)
}

export function DocumentEmailButton({ document }: { document: Document }) {
  const [open, setOpen] = useState(false)
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [selected, setSelected] = useState<EmailTemplate | null>(null)
  const [toEmail, setToEmail] = useState('')
  const [toName, setToName] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!open) return
    const supabase = createClient()

    // Load templates (prefer proposal/agreement type)
    ;(supabase as any).from('email_templates').select('*').order('name').then(({ data }: any) => {
      setTemplates((data || []) as EmailTemplate[])
    })

    // Try to get client contact from document content
    const content = document.content as any
    if (content?.contactEmail || content?.clientEmail) {
      setToEmail(content.contactEmail || content.clientEmail || '')
    }
    if (content?.contactName || content?.clientName) {
      setToName(content.contactName || content.clientName || '')
    }

    // Pre-fill subject
    setSubject(`${document.title || 'Document'} — Core Cleaning`)
  }, [open])

  function pickTemplate(t: EmailTemplate) {
    setSelected(t)
    const vars = {
      contact_name: toName,
      business_name: (document.content as any)?.companyName || (document.content as any)?.clientName || '',
    }
    setSubject(applyVars(t.subject, vars))
    setBody(applyVars(t.body, vars))
  }

  async function handleSend() {
    if (!toEmail) return setError('Email address required')
    if (!subject) return setError('Subject required')
    if (!body) return setError('Body required')
    setSending(true)
    setError(null)
    const result = await sendEmailAction({
      client_id: document.client_id || null,
      to_email: toEmail,
      to_name: toName,
      subject,
      body,
      template_id: selected?.id || null,
      document_id: document.id || null,
    })
    setSending(false)
    if (result.error) return setError(result.error)
    setSuccess(true)
    setTimeout(() => { setSuccess(false); setOpen(false) }, 2000)
  }

  const inp = 'w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900'
  const lbl = 'block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5'

  // Show relevant templates first
  const relevant = templates.filter(t =>
    document.document_type === 'proposal'
      ? ['proposal_followup', 'onboarding', 'upsell'].includes(t.type)
      : ['agreement_followup', 'onboarding', 'thankyou'].includes(t.type)
  )
  const others = templates.filter(t => !relevant.includes(t))

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Send className="w-3.5 h-3.5" />
        Send Email
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-semibold text-gray-900">Send Email</h3>
                <p className="text-xs text-gray-400 mt-0.5">{document.title}</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-md px-3 py-2">✓ Email sent!</div>}
              {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-md px-3 py-2">{error}</div>}

              {templates.length > 0 && (
                <div>
                  <label className={lbl}>Quick templates</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
                    {[...relevant, ...others].map(t => (
                      <button key={t.id} onClick={() => pickTemplate(t)}
                        className={`text-left px-3 py-2 rounded-lg border text-xs font-medium transition ${selected?.id === t.id ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-700 hover:border-gray-400'}`}>
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>To email *</label>
                  <input className={inp} value={toEmail} onChange={e => setToEmail(e.target.value)} placeholder="client@email.com" />
                </div>
                <div>
                  <label className={lbl}>Recipient name</label>
                  <input className={inp} value={toName} onChange={e => setToName(e.target.value)} placeholder="Contact name" />
                </div>
              </div>
              <div>
                <label className={lbl}>Subject *</label>
                <input className={inp} value={subject} onChange={e => setSubject(e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Message *</label>
                <textarea className={`${inp} min-h-[200px] resize-y leading-relaxed`} value={body} onChange={e => setBody(e.target.value)} placeholder="Write your message…" />
              </div>
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
              {(document.content as any)?.type === 'proposal_v2' ? (
                <span className="text-xs text-gray-400 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                  PDF proposal attached automatically
                </span>
              ) : <span />}
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={handleSend} disabled={sending}>
                  <Send className="w-3.5 h-3.5" />
                  {sending ? 'Sending…' : 'Send Email'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
