'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { createFinancialRecordAction } from '@/actions/financial'
import { EXPENSE_CATEGORIES } from '@/lib/constants'
import type { Client } from '@/types/app'

const TYPE_OPTIONS = [
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
]

const CATEGORY_OPTIONS = [
  ...EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c })),
  { value: 'Contract Cleaning', label: 'Contract Cleaning (Income)' },
]

interface ExpenseFormProps {
  clients: Client[]
  open: boolean
  onClose: () => void
}

export function ExpenseForm({ clients, open, onClose }: ExpenseFormProps) {
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[]>>({})

  const clientOptions = [
    { value: '', label: 'No client (general)' },
    ...clients.map((c) => ({ value: c.id, label: c.business_name })),
  ]

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setErrors({})
    const fd = new FormData(e.currentTarget)
    const result = await createFinancialRecordAction(fd)
    if (result?.error) {
      setErrors(result.error as Record<string, string[]>)
    } else {
      onClose()
    }
    setLoading(false)
  }

  return (
    <Modal open={open} onOpenChange={onClose} title="Add Financial Record">
      <form onSubmit={handleSubmit} className="space-y-4">
        {errors._form && (
          <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3">
            {errors._form.join(', ')}
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Type *"
            name="type"
            options={TYPE_OPTIONS}
            placeholder="Select type…"
            error={errors.type?.[0]}
          />
          <Input
            label="Amount ($) *"
            name="amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            error={errors.amount?.[0]}
          />
        </div>
        <Input
          label="Date *"
          name="record_date"
          type="date"
          defaultValue={new Date().toISOString().split('T')[0]}
          error={errors.record_date?.[0]}
        />
        <Select
          label="Category *"
          name="category"
          options={CATEGORY_OPTIONS}
          placeholder="Select category…"
          error={errors.category?.[0]}
        />
        <Select
          label="Client (optional)"
          name="client_id"
          options={clientOptions}
        />
        <Textarea
          label="Description"
          name="description"
          rows={2}
          placeholder="Brief description…"
        />
        <div className="flex gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving…' : 'Add Record'}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  )
}
