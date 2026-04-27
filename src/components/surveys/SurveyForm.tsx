'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { createSurveyAction } from '@/actions/surveys'
import type { Client } from '@/types/app'
import { cn } from '@/lib/utils'

interface SurveyFormProps {
  clients: Client[]
  preselectedClientId?: string
}

function ScoreInput({
  label,
  name,
  value,
  onChange,
}: {
  label: string
  name: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <span className={cn(
          'text-lg font-bold',
          value >= 8 ? 'text-green-600' : value >= 7 ? 'text-amber-500' : value > 0 ? 'text-red-600' : 'text-gray-300'
        )}>
          {value > 0 ? `${value}/10` : '—'}
        </span>
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: 11 }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            className={cn(
              'w-8 h-8 rounded-md text-xs font-medium transition',
              value === i
                ? i === 0 ? 'bg-red-500 text-white' : i < 7 ? 'bg-red-400 text-white' : i < 8 ? 'bg-amber-400 text-white' : 'bg-green-500 text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            )}
          >
            {i}
          </button>
        ))}
      </div>
      <input type="hidden" name={name} value={value} />
    </div>
  )
}

export function SurveyForm({ clients, preselectedClientId }: SurveyFormProps) {
  const router = useRouter()
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(false)

  const [quality, setQuality] = useState(0)
  const [reliability, setReliability] = useState(0)
  const [communication, setCommunication] = useState(0)
  const [value, setValue] = useState(0)

  const clientOptions = clients.map((c) => ({
    value: c.id,
    label: c.business_name,
  }))

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setErrors({})
    const result = await createSurveyAction(new FormData(e.currentTarget))
    if (result?.error) {
      setErrors(result.error as Record<string, string[]>)
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errors._form && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {errors._form.join(', ')}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          label="Client *"
          name="client_id"
          options={[{ value: '', label: 'Select a client…' }, ...clientOptions]}
          defaultValue={preselectedClientId || ''}
          error={errors.client_id?.[0]}
          placeholder="Select a client…"
        />
        <Input
          label="Survey Date *"
          name="submitted_at"
          type="date"
          defaultValue={new Date().toISOString().split('T')[0]}
          error={errors.submitted_at?.[0]}
        />
      </div>

      <div className="bg-gray-50 rounded-xl p-5 space-y-5">
        <p className="text-sm font-semibold text-gray-700">Scores (0–10)</p>
        <ScoreInput label="Quality of Cleaning" name="quality_score" value={quality} onChange={setQuality} />
        <ScoreInput label="Reliability & Consistency" name="reliability_score" value={reliability} onChange={setReliability} />
        <ScoreInput label="Communication" name="communication_score" value={communication} onChange={setCommunication} />
        <ScoreInput label="Value for Money" name="value_score" value={value} onChange={setValue} />
      </div>

      <Textarea
        label="Comments"
        name="comments"
        rows={3}
        placeholder="Any additional feedback from the client…"
      />

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving…' : 'Save Survey'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
