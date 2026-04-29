'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateCleanerNameAction } from '@/actions/team'
import { Pencil, X } from 'lucide-react'

interface Props {
  profileId: string
  userId:    string
  fullName:  string
  email:     string   // kept for display/login reference only
}

export function EditCleanerModal({ profileId, userId, fullName, email }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  // Split stored full name into first / last on open
  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [password,  setPassword]  = useState('')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [saved,     setSaved]     = useState(false)

  const inp = 'w-full border-b border-gray-200 py-2.5 text-sm text-black placeholder-gray-400 focus:outline-none focus:border-black transition-colors bg-transparent'

  function handleOpen() {
    // Split stored full name into first / last best-effort
    const parts = (fullName ?? '').trim().split(' ')
    setFirstName(parts[0] ?? '')
    setLastName(parts.slice(1).join(' ') ?? '')
    setPassword('')
    setError(null)
    setSaved(false)
    setOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim()) return setError('First and last name are required')
    if (password && password.length < 5)       return setError('Password must be at least 5 characters')
    setSaving(true)
    setError(null)
    const result = await updateCleanerNameAction({
      profileId,
      userId,
      firstName: firstName.trim(),
      lastName:  lastName.trim(),
      newPassword: password || null,
    })
    setSaving(false)
    if (result.error) return setError(result.error)
    setSaved(true)
    router.refresh()
    setTimeout(() => setOpen(false), 700)
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-black"
        aria-label="Edit cleaner"
      >
        <Pencil className="w-4 h-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-sm p-4">
          <div
            className="w-full max-w-md bg-white rounded-3xl px-6 py-6 shadow-xl"
            style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-black">Edit Cleaner</h2>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-full hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {error && <p className="text-xs text-red-500">{error}</p>}
              {saved && <p className="text-xs text-green-700 font-medium">✓ Saved</p>}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-400 mb-1.5">First Name</p>
                  <input
                    className={inp}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Jane"
                    autoComplete="given-name"
                  />
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1.5">Last Name</p>
                  <input
                    className={inp}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Smith"
                    autoComplete="family-name"
                  />
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-400 mb-1.5">
                  New Password{' '}
                  <span className="text-gray-300">(leave blank to keep current)</span>
                </p>
                <input
                  className={inp}
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 5 characters"
                  autoComplete="new-password"
                />
              </div>

              {/* Username reference — read-only */}
              {email && (
                <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-gray-400 mb-0.5">Username</p>
                  <p className="text-xs font-mono text-gray-700 break-all">
                    {email.replace('@delta-cleaner.internal', '')}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">Cleaner logs in with this username + password</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 border border-gray-200 text-black text-sm font-semibold rounded-2xl py-3 active:scale-[0.98] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-black text-white text-sm font-semibold rounded-2xl py-3 disabled:opacity-40 active:scale-[0.98] transition-all"
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
