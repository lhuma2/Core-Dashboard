'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updatePortalUserAction } from '@/actions/team'
import { Pencil, X } from 'lucide-react'

interface Client {
  id: string
  business_name: string
}

interface Props {
  profileId: string
  userId: string
  fullName: string
  email: string
  role: string
  linkedClientId?: string | null
  clients?: Client[]
}

const ROLE_LABELS: Record<string, string> = {
  cleaner: 'Cleaner',
  manager: 'Team Manager',
  client:  'Client Portal',
  admin:   'Admin',
}

export function EditPortalUserModal({ profileId, userId, fullName, email, role, linkedClientId, clients = [] }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(fullName)
  const [emailVal, setEmailVal] = useState(email)
  const [password, setPassword] = useState('')
  const [linkedClient, setLinkedClient] = useState(linkedClientId ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const inp = 'w-full bg-white border border-gray-200 text-gray-900 text-sm rounded-lg px-3 py-2.5 placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 transition-colors'
  const lbl = 'block text-xs font-medium text-gray-600 mb-1.5'

  function handleOpen() {
    setName(fullName)
    setEmailVal(email)
    setPassword('')
    setLinkedClient(linkedClientId ?? '')
    setError(null)
    setSaved(false)
    setOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !emailVal.trim()) return setError('Name and email are required')
    if (password && password.length < 5) return setError('Password must be at least 5 characters')
    setSaving(true)
    setError(null)
    const result = await updatePortalUserAction({
      profileId,
      userId,
      fullName: name.trim(),
      email: emailVal.trim(),
      newPassword: password || null,
      linkedClientId: role === 'client' ? (linkedClient || null) : undefined,
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
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        title="Edit user"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-gray-100 p-6 my-6 sm:my-8 max-h-[calc(100dvh-3rem)] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Edit User</h2>
                <p className="text-xs text-gray-400 mt-0.5">{ROLE_LABELS[role] ?? role}</p>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg px-3 py-2.5">
                  {error}
                </div>
              )}
              {saved && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg px-3 py-2.5">
                  ✓ Saved
                </div>
              )}

              <div>
                <label className={lbl}>Full Name</label>
                <input className={inp} value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" />
              </div>

              <div>
                <label className={lbl}>Email</label>
                <input className={inp} type="email" value={emailVal} onChange={(e) => setEmailVal(e.target.value)} placeholder="jane@email.com" />
              </div>

              <div>
                <label className={lbl}>New Password <span className="text-gray-400 font-normal">(leave blank to keep current)</span></label>
                <input className={inp} type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 5 characters" autoComplete="new-password" />
              </div>

              {role === 'client' && clients.length > 0 && (
                <div>
                  <label className={lbl}>Linked Client Account</label>
                  <select className={inp} value={linkedClient} onChange={(e) => setLinkedClient(e.target.value)}>
                    <option value="">No client linked</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.business_name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg py-2.5 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-[#1e3a5f] text-white text-sm font-medium rounded-lg py-2.5 disabled:opacity-40 hover:bg-[#162d4a] transition-colors"
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
