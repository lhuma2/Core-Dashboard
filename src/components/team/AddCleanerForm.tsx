'use client'

import { useState } from 'react'
import { addCleanerDetailedAction } from '@/actions/team'

export function AddCleanerForm() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [region, setRegion] = useState<'brisbane' | 'gold_coast'>('brisbane')
  const [isTeamLeader, setIsTeamLeader] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inp = 'w-full bg-white border border-gray-200 text-gray-900 text-sm rounded-lg px-3 py-2.5 placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors'
  const lbl = 'block text-xs font-medium text-gray-600 mb-1.5'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim() || !email.trim() || !phone.trim()) {
      return setError('Full name, email and contact number are required')
    }
    setSubmitting(true)
    setError(null)
    try {
      const result = await addCleanerDetailedAction({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        region,
        isTeamLeader,
      })
      setSubmitting(false)
      if (result?.error) return setError(result.error)
      window.location.href = '/team'
    } catch (err: any) {
      setSubmitting(false)
      setError(err?.message ?? 'Something went wrong. Please try again.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg px-3 py-2.5">
          {error}
        </div>
      )}

      <div>
        <label className={lbl}>Full Name</label>
        <input className={inp} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Smith" />
      </div>

      <div>
        <label className={lbl}>Contact Number</label>
        <input className={inp} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0412 345 678" />
      </div>

      <div>
        <label className={lbl}>Email</label>
        <input className={inp} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@email.com" />
      </div>

      <div>
        <label className={lbl}>Region</label>
        <div className="grid grid-cols-2 gap-1.5">
          {([
            ['brisbane', 'Brisbane'],
            ['gold_coast', 'Gold Coast'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setRegion(value)}
              className={`text-xs font-semibold py-2 rounded-lg border transition-all ${
                region === value
                  ? 'bg-[#00250e] border-[#00250e] text-white'
                  : 'border-gray-200 text-gray-500 hover:border-gray-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isTeamLeader}
          onChange={(e) => setIsTeamLeader(e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 text-[#00250e] focus:ring-[#00250e]"
        />
        <span className="text-xs font-medium text-gray-600">Team Leader</span>
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-[#003314] hover:bg-[#00250e] text-white text-sm font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 mt-2"
      >
        {submitting ? 'Adding…' : 'Add Cleaner'}
      </button>
    </form>
  )
}
