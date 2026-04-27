'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'

interface LeadFormProps {
  onSubmit: (formData: FormData) => Promise<void>
  onCancel: () => void
  defaultValues?: Partial<Record<string, any>>
  submitLabel?: string
}

const inputClass = 'w-full bg-slate-700/50 border border-slate-600 text-slate-100 placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50'
const labelClass = 'text-xs font-medium text-slate-400 block mb-1.5'

export function LeadForm({ onSubmit, onCancel, defaultValues = {}, submitLabel }: LeadFormProps) {
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    await onSubmit(new FormData(e.currentTarget))
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>Business Name *</label>
        <input name="business_name" required placeholder="e.g. Acme Corp" defaultValue={defaultValues.business_name ?? ''} className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Contact Name</label>
          <input name="contact_name" placeholder="Full name" defaultValue={defaultValues.contact_name ?? ''} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Phone</label>
          <input name="contact_phone" placeholder="0400 000 000" defaultValue={defaultValues.contact_phone ?? ''} className={inputClass} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Email</label>
        <input name="contact_email" type="email" placeholder="contact@company.com" defaultValue={defaultValues.contact_email ?? ''} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Address</label>
        <input name="address" placeholder="Street address" className={inputClass} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>Suburb</label>
          <input name="suburb" placeholder="Suburb" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>State</label>
          <select name="state" defaultValue="QLD" className={inputClass + ' cursor-pointer'}>
            {['QLD', 'NSW', 'VIC', 'SA', 'WA', 'TAS', 'NT', 'ACT'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Postcode</label>
          <input name="postcode" placeholder="4000" className={inputClass} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Source</label>
        <select name="source" className={inputClass + ' cursor-pointer'}>
          <option value="">Select source…</option>
          {['Referral', 'Google', 'Website', 'Cold outreach', 'Social media', 'Trade show', 'Other'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Quote Value (AUD/month)</label>
        <input name="quote_value" type="number" step="0.01" placeholder="0.00" className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Notes</label>
        <textarea name="notes" rows={3} placeholder="Any notes about this lead…" className={inputClass + ' resize-none'} />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving…' : (submitLabel ?? 'Create Lead')}
        </Button>
      </div>
    </form>
  )
}
