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

interface BondJobFormProps {
  action: (formData: FormData) => Promise<{ error?: Record<string, string[]> } | void>
  cleaners: CleanerOption[]
}

export function BondJobForm({ action, cleaners }: BondJobFormProps) {
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(false)

  const cleanerOptions = [
    { value: '', label: 'Unassigned' },
    ...cleaners.map((c) => ({ value: c.id, label: c.fullName })),
  ]

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setErrors({})
    const fd = new FormData(e.currentTarget)
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

      <div className="grid grid-cols-2 gap-4">
        <Input
          type="date"
          name="clean_date"
          label="Date of clean"
          error={errors.clean_date?.[0]}
          required
        />
        <Input
          type="time"
          name="clean_time"
          label="Time of clean"
          error={errors.clean_time?.[0]}
        />
      </div>

      <Select
        name="cleaner_id"
        label="Assign cleaner"
        options={cleanerOptions}
        defaultValue=""
      />

      <Textarea
        name="comments"
        label="Comments"
        placeholder="Access details, special instructions, etc."
        rows={3}
        error={errors.comments?.[0]}
      />

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Saving…' : 'Add Bond Clean'}
      </Button>
    </form>
  )
}
