'use client'

import { useState } from 'react'
import { createPortalUserAction } from '@/actions/team'

export function ManagerAddCleanerForm() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const inp = 'w-full border-b border-gray-200 py-2.5 text-sm text-black placeholder-gray-400 focus:outline-none focus:border-black transition-colors bg-transparent'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName || !email || !password) return setError('All fields required')
    if (password.length < 5) return setError('Password must be at least 5 characters')
    setSubmitting(true)
    const result = await createPortalUserAction({
      email, password, fullName, role: 'cleaner', linkedClientId: null,
    })
    setSubmitting(false)
    if (result.error) return setError(result.error)
    window.location.href = '/manager/team'
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {success && <p className="text-xs text-green-700 font-medium">✓ Cleaner account created</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
      <input className={inp} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" />
      <input className={inp} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" />
      <input className={inp} type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Temporary password" />
      <button type="submit" disabled={submitting}
        className="w-full bg-black text-white text-sm font-semibold rounded-2xl py-3.5 disabled:opacity-40 active:scale-[0.98] transition-all mt-1">
        {submitting ? 'Creating…' : 'Add Cleaner'}
      </button>
    </form>
  )
}
