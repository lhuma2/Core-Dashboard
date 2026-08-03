'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'

interface CleanerOption {
  id: string
  fullName: string
}

interface ResidentialJobFormProps {
  action: (formData: FormData) => Promise<{ error?: Record<string, string[]> } | void>
  cleaners: CleanerOption[]
}

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const FREQUENCY_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
]

export function ResidentialJobForm({ action, cleaners }: ResidentialJobFormProps) {
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(false)
  const [isRecurring, setIsRecurring] = useState(false)
  const [frequency, setFrequency] = useState('weekly')
  const [serviceDays, setServiceDays] = useState<string[]>([])

  const cleanerOptions = [
    { value: '', label: 'Unassigned' },
    ...cleaners.map((c) => ({ value: c.id, label: c.fullName })),
  ]

  const countOptions = Array.from({ length: 8 }, (_, n) => ({ value: String(n), label: String(n) }))

  function toggleDay(day: string) {
    setServiceDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day])
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setErrors({})
    const fd = new FormData(e.currentTarget)
    fd.set('is_recurring', isRecurring ? 'true' : 'false')
    if (isRecurring) {
      fd.set('frequency', frequency)
      fd.delete('service_days')
      serviceDays.forEach((d) => fd.append('service_days', d))
    }
    try {
      const result = await action(fd)
      if (result?.error) {
        setErrors(result.error as Record<string, string[]>)
        setLoading(false)
      }
    } catch (err: any) {
      if (err?.digest?.startsWith?.('NEXT_REDIRECT')) return
      setErrors({ _form: ['An unexpected error occurred. Please try again.'] })
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {errors._form && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {errors._form[0]}
        </p>
      )}

      <Input
        name="client_name"
        label="Client name"
        placeholder="e.g. Jane Smith"
        error={errors.client_name?.[0]}
        required
      />

      <Input
        name="address"
        label="Address of the clean"
        placeholder="Unit 4, 12 Example St, Suburb QLD"
        error={errors.address?.[0]}
        required
      />

      <Input
        name="contact_phone"
        label="Contact number"
        placeholder="04xx xxx xxx"
        error={errors.contact_phone?.[0]}
      />

      <div className="rounded-xl border border-gray-200 p-4 space-y-3 bg-gray-50/60">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Schedule</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setIsRecurring(false)}
            className={`rounded-lg border-2 px-3 py-2.5 text-sm font-semibold text-left transition-all ${!isRecurring ? 'border-[#00250e] bg-[#00250e]/5 text-[#00250e]' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
          >
            One-off
          </button>
          <button
            type="button"
            onClick={() => setIsRecurring(true)}
            className={`rounded-lg border-2 px-3 py-2.5 text-sm font-semibold text-left transition-all ${isRecurring ? 'border-[#00250e] bg-[#00250e]/5 text-[#00250e]' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
          >
            Ongoing
          </button>
        </div>

        {isRecurring && (
          <div className="space-y-3 pt-1">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Frequency</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="w-full bg-white border border-gray-200 text-gray-900 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#00250e]"
              >
                {FREQUENCY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Which day{frequency !== 'monthly' ? '(s)' : ''}?</label>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <button key={day} type="button" onClick={() => toggleDay(day)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${serviceDays.includes(day) ? 'bg-[#00250e] text-white border-[#00250e]' : 'bg-white text-gray-600 border-gray-300 hover:border-[#00250e]'}`}>
                    {day}
                  </button>
                ))}
              </div>
              {serviceDays.length > 0 && (
                <p className="text-xs text-[#00250e] mt-2 font-medium">Cleans on: {serviceDays.join(', ')}</p>
              )}
              {errors.frequency?.[0] && <p className="text-xs text-red-600 mt-1">{errors.frequency[0]}</p>}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          type="date"
          name="clean_date"
          label={isRecurring ? 'Start date' : 'Date of clean'}
          error={errors.clean_date?.[0]}
          required
        />
        <Input
          type="time"
          name="clean_time"
          label={isRecurring ? 'Time (every occurrence)' : 'Time of clean'}
          error={errors.clean_time?.[0]}
        />
      </div>

      <Select
        name="cleaner_id"
        label="Assign cleaner"
        options={cleanerOptions}
        defaultValue=""
      />

      <Input
        type="number"
        step="0.01"
        min="0"
        name="cleaner_cost"
        label="Cleaner Cost ($)"
        placeholder="e.g. 90.00"
        error={errors.cleaner_cost?.[0]}
      />
      <p className="text-xs text-gray-400 -mt-3">What you're paying the cleaner for this job — flows into the Xero profit &amp; loss.</p>

      <div className="grid grid-cols-2 gap-4">
        <Select
          name="bedrooms"
          label="Bedrooms"
          options={countOptions}
          defaultValue="0"
          error={errors.bedrooms?.[0]}
        />
        <Select
          name="bathrooms"
          label="Bathrooms"
          options={countOptions}
          defaultValue="0"
          error={errors.bathrooms?.[0]}
        />
      </div>

      <div>
        <p className="text-sm font-medium text-gray-700 mb-1.5">Carpet Steam Cleaning</p>
        <div className="grid grid-cols-2 gap-4">
          <Select
            name="carpet_steam_rooms"
            label="Rooms"
            options={countOptions}
            defaultValue="0"
            error={errors.carpet_steam_rooms?.[0]}
          />
          <Select
            name="carpet_steam_hallways"
            label="Hallways"
            options={countOptions}
            defaultValue="0"
            error={errors.carpet_steam_hallways?.[0]}
          />
        </div>
      </div>

      <Textarea
        name="comments"
        label="Comments"
        placeholder="Access details, special instructions, etc."
        rows={3}
        error={errors.comments?.[0]}
      />

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Saving…' : isRecurring ? 'Add Ongoing Residential Clean' : 'Add Residential Clean'}
      </Button>
    </form>
  )
}
