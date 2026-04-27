'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { SOP_CATEGORIES } from '@/lib/constants'
import type { SOP } from '@/types/app'

const CATEGORY_OPTIONS = SOP_CATEGORIES.map((c) => ({ value: c, label: c }))

interface SOPFormProps {
  defaultValues?: Partial<SOP>
  action: (formData: FormData) => Promise<{ error?: Record<string, string[]> } | void>
  submitLabel?: string
}

export function SOPForm({ defaultValues, action, submitLabel = 'Save SOP' }: SOPFormProps) {
  const router = useRouter()
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setErrors({})
    const result = await action(new FormData(e.currentTarget))
    if (result?.error) setErrors(result.error as Record<string, string[]>)
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {errors._form && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {errors._form.join(', ')}
        </div>
      )}
      <Input
        label="Title *"
        name="title"
        defaultValue={defaultValues?.title}
        error={errors.title?.[0]}
        placeholder="e.g. General Office Cleaning Procedure"
        required
      />
      <Select
        label="Category *"
        name="category"
        options={CATEGORY_OPTIONS}
        defaultValue={defaultValues?.category || ''}
        placeholder="Select a category…"
        error={errors.category?.[0]}
      />
      <Textarea
        label="Content *"
        name="content"
        defaultValue={defaultValues?.content || ''}
        error={errors.content?.[0]}
        rows={18}
        placeholder="Write the SOP content here. Markdown is supported."
        hint="Use ## for headings, - for bullet lists, **bold** for emphasis"
      />
      {defaultValues?.id && (
        <input type="hidden" name="active" value={defaultValues.active ? 'true' : 'false'} />
      )}
      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving…' : submitLabel}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
