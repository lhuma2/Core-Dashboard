'use client'

import { useEffect } from 'react'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { formatAUD } from '@/lib/formatters'
import { FREQUENCY_LABELS, SERVICE_TYPE_LABELS } from '@/lib/constants'
import { calculateBillingBreakdown, FREQUENCY_MULTIPLIERS } from '@/lib/billing'
import type { FrequencyType, ServiceType } from '@/types/app'

const SERVICE_OPTIONS = Object.entries(SERVICE_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}))

const FREQUENCY_OPTIONS = Object.entries(FREQUENCY_LABELS).map(([value, label]) => ({
  value,
  label,
}))

interface BillingCalculatorProps {
  selectedServices: ServiceType[]
  onServicesChange: (services: ServiceType[]) => void
  frequency: FrequencyType
  onFrequencyChange: (f: FrequencyType) => void
  ratePerVisit: number
  onRateChange: (r: number) => void
  onBreakdownChange: (breakdown: {
    monthlyValue: number
    annualValue: number
    visitsPerMonth: number
  }) => void
  gstInclusive: boolean
  onGstChange: (v: boolean) => void
}

export function BillingCalculator({
  selectedServices,
  onServicesChange,
  frequency,
  onFrequencyChange,
  ratePerVisit,
  onRateChange,
  onBreakdownChange,
  gstInclusive,
  onGstChange,
}: BillingCalculatorProps) {
  const breakdown =
    ratePerVisit > 0
      ? calculateBillingBreakdown(ratePerVisit, frequency)
      : null

  useEffect(() => {
    if (breakdown) {
      onBreakdownChange({
        monthlyValue: breakdown.monthlyValue,
        annualValue: breakdown.annualValue,
        visitsPerMonth: breakdown.visitsPerMonth,
      })
    }
  }, [ratePerVisit, frequency])

  function toggleService(type: ServiceType) {
    if (selectedServices.includes(type)) {
      onServicesChange(selectedServices.filter((s) => s !== type))
    } else {
      onServicesChange([...selectedServices, type])
    }
  }

  return (
    <div className="bg-gray-50 rounded-xl p-5 space-y-5">
      <h3 className="text-sm font-semibold text-gray-700">Billing Details</h3>

      {/* Service Types */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-gray-600">Service Types *</label>
        <div className="flex flex-wrap gap-2">
          {SERVICE_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => toggleService(value as ServiceType)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                selectedServices.includes(value as ServiceType)
                  ? 'bg-brand-navy text-white border-brand-navy'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-brand-navy'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Frequency"
          options={FREQUENCY_OPTIONS}
          value={frequency}
          onChange={(e) => onFrequencyChange(e.target.value as FrequencyType)}
        />
        <Input
          label="Rate per Visit ($)"
          type="number"
          step="0.01"
          min="0"
          value={ratePerVisit || ''}
          onChange={(e) => onRateChange(parseFloat(e.target.value) || 0)}
          placeholder="0.00"
        />
      </div>

      {/* GST */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={gstInclusive}
          onChange={(e) => onGstChange(e.target.checked)}
          className="rounded border-gray-300 text-brand-navy focus:ring-brand-navy"
        />
        <span className="text-sm text-gray-600">Prices include GST</span>
      </label>

      {/* Live breakdown */}
      {breakdown && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">
            Billing Breakdown
          </p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Rate per visit</span>
              <span className="font-medium">{formatAUD(breakdown.ratePerVisit)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">
                Visits/month ({FREQUENCY_LABELS[frequency]})
              </span>
              <span className="font-medium">
                {breakdown.visitsPerMonth.toFixed(2)} ×{' '}
                {(FREQUENCY_MULTIPLIERS[frequency]).toFixed(4)}
              </span>
            </div>
            <div className="border-t border-gray-100 pt-2 flex justify-between text-sm font-semibold">
              <span>Monthly value</span>
              <span className="text-brand-navy text-base">
                {formatAUD(breakdown.monthlyValue)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Annual value</span>
              <span className="font-semibold">{formatAUD(breakdown.annualValue)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
