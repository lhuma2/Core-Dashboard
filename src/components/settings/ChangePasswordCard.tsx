'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'
import { KeyRound } from 'lucide-react'

export function ChangePasswordCard() {
  const [pw, setPw]         = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy]     = useState(false)
  const [msg, setMsg]       = useState<{ ok: boolean; text: string } | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (pw.length < 8)      { setMsg({ ok: false, text: 'Use at least 8 characters.' }); return }
    if (pw !== confirm)     { setMsg({ ok: false, text: 'Passwords do not match.' }); return }
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) { setMsg({ ok: false, text: error.message }); return }
    setPw(''); setConfirm('')
    setMsg({ ok: true, text: 'Password updated. Use it next time you sign in.' })
  }

  return (
    <Card>
      <div className="flex items-center gap-2 mb-5">
        <KeyRound className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-700">Change Password</h3>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">New password</label>
          <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)}
            placeholder="At least 8 characters" autoComplete="new-password" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Confirm new password</label>
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
            placeholder="Re-enter new password" autoComplete="new-password" />
        </div>
        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" size="sm" disabled={busy}>{busy ? 'Updating…' : 'Update Password'}</Button>
          {msg && <p className={`text-xs ${msg.ok ? 'text-green-600' : 'text-red-500'}`}>{msg.text}</p>}
        </div>
      </form>
    </Card>
  )
}
