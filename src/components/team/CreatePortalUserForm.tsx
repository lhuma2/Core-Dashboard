'use client'

import { useState } from 'react'
import { createPortalUserAction } from '@/actions/team'

interface Client {
  id: string
  business_name: string
  contact_name?: string | null
  contact_email?: string | null
}

export function CreatePortalUserForm({ clients }: { clients: Client[] }) {
  const [role, setRole] = useState<'cleaner' | 'manager' | 'client'>('cleaner')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [linkedClientId, setLinkedClientId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const inp = 'w-full bg-white border border-gray-200 text-gray-900 text-sm rounded-lg px-3 py-2.5 placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors'
  const lbl = 'block text-xs font-medium text-gray-600 mb-1.5'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      return setError('All fields are required')
    }
    if (password.length < 5) {
      return setError('Password must be at least 5 characters')
    }
    if (role === 'client' && !linkedClientId) {
      return setError('Please select the linked client account')
    }
    setSubmitting(true)
    setError(null)
    try {
      const result = await createPortalUserAction({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        role,
        linkedClientId: role === 'client' ? linkedClientId : null,
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
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg px-3 py-2.5">
          ✓ User created successfully
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg px-3 py-2.5">
          {error}
        </div>
      )}

      {/* Role selector */}
      <div>
        <label className={lbl}>Role</label>
        <div className="grid grid-cols-3 gap-1.5">
          {(['cleaner', 'manager', 'client'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`text-xs font-semibold py-2 rounded-lg border capitalize transition-all ${
                role === r
                  ? 'bg-[#1e3a5f] border-[#1e3a5f] text-white'
                  : 'border-gray-200 text-gray-500 hover:border-gray-400'
              }`}
            >
              {r === 'manager' ? 'Manager' : r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={lbl}>Full Name</label>
        <input className={inp} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Smith" />
      </div>

      <div>
        <label className={lbl}>Email</label>
        <input className={inp} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@email.com" />
      </div>

      <div>
        <label className={lbl}>Temporary Password</label>
        <input className={inp} type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 5 characters" />
      </div>

      {role === 'client' && (
        <div>
          <label className={lbl}>Linked Client Account</label>
          <select
            className={inp}
            value={linkedClientId}
            onChange={(e) => {
              const selected = clients.find((c) => c.id === e.target.value)
              setLinkedClientId(e.target.value)
              if (selected) {
                if (selected.contact_name) setFullName(selected.contact_name)
                if (selected.contact_email) setEmail(selected.contact_email)
              }
            }}
          >
            <option value="">Select client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.business_name}</option>
            ))}
          </select>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-[#003314] hover:bg-[#00250e] text-white text-sm font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 mt-2"
      >
        {submitting ? 'Creating…' : 'Create User'}
      </button>
    </form>
  )
}
