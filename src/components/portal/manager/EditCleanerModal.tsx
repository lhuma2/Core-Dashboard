'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updatePortalUserAction } from '@/actions/team'
import { Pencil, X } from 'lucide-react'

interface Props {
  profileId: string
  userId: string
  fullName: string
  email: string
}

export function EditCleanerModal({ profileId, userId, fullName, email }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(fullName)
  const [emailVal, setEmailVal] = useState(email)
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const inp = 'w-full border-b border-gray-200 py-2.5 text-sm text-black placeholder-gray-400 focus:outline-none focus:border-black transition-colors bg-transparent'

  function handleOpen() {
    setName(fullName)
    setEmailVal(email)
    setPassword('')
    setError(null)
    setSaved(false)
    setOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !emailVal.trim()) return setError('Both fields are required')
    if (password && password.length < 5) return setError('Password must be at least 5 characters')
    setSaving(true)
    setError(null)
    const result = await updatePortalUserAction({
      profileId,
      userId,
      fullName: name.trim(),
      email: emailVal.trim(),
      newPassword: password || null,
    })
    setSaving(false)
    if (result.error) return setError(result.error)
    setSaved(true)
    router.refresh()
    setTimeout(() => setOpen(false), 800)
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
              <div>
                <p className="text-xs text-gray-400 mb-1.5">Full Name</p>
                <input
                  className={inp}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Smith"
                />
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1.5">Email</p>
                <input
                  className={inp}
                  type="email"
                  value={emailVal}
                  onChange={(e) => setEmailVal(e.target.value)}
                  placeholder="jane@email.com"
                />
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1.5">
                  New Password <span className="text-gray-300">(leave blank to keep current)</span>
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
