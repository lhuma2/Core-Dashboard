'use client'

import { useState } from 'react'
import { KeyRound, Send, Loader2, Check, Sparkles, ExternalLink, Wand2 } from 'lucide-react'
import { saveClientPortalLoginAction, sendWelcomeAction, markClientReviewedAction } from '@/actions/welcome'

function makePassword(): string {
  const words = ['clean', 'shine', 'fresh', 'spark', 'bright', 'gleam', 'polish', 'crisp']
  const w = words[Math.floor(Math.random() * words.length)]
  return `${w.charAt(0).toUpperCase()}${w.slice(1)}${Math.floor(1000 + Math.random() * 9000)}!`
}

// Client profile: choose the client's portal login, then send their welcome page.
// Only rendered for commercial clients (residential / end-of-lease live elsewhere).
export function ClientWelcomeCard({
  clientId, needsReview, login, contactEmail, contactName, welcomeSentAt, welcomeCode,
}: {
  clientId: string
  needsReview: boolean
  login: { email: string; name: string | null } | null
  contactEmail: string | null
  contactName: string | null
  welcomeSentAt: string | null
  welcomeCode: string | null
}) {
  const [email, setEmail] = useState(login?.email ?? contactEmail ?? '')
  const [name, setName] = useState(login?.name ?? contactName ?? '')
  const [password, setPassword] = useState('')
  const [hasLogin, setHasLogin] = useState(!!login)
  const [busy, setBusy] = useState<'save' | 'send' | 'review' | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [sentAt, setSentAt] = useState(welcomeSentAt)
  const [reviewed, setReviewed] = useState(!needsReview)

  const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00250e]/20 focus:border-[#00250e]'
  const lbl = 'block text-xs font-medium text-gray-500 mb-1.5'

  async function save() {
    setMsg(null); setBusy('save')
    const res = await saveClientPortalLoginAction(clientId, { email, fullName: name, password })
    setBusy(null)
    if ('error' in res && res.error) { setMsg({ ok: false, text: res.error }); return }
    setHasLogin(true); setReviewed(true)
    setMsg({ ok: true, text: 'Login saved. They can sign in with it now.' })
  }

  async function send() {
    setMsg(null); setBusy('send')
    // A typed password is saved first, so the one in the email always works.
    if (password) {
      const saved = await saveClientPortalLoginAction(clientId, { email, fullName: name, password })
      if ('error' in saved && saved.error) { setBusy(null); setMsg({ ok: false, text: saved.error }); return }
      setHasLogin(true)
    }
    const res = await sendWelcomeAction(clientId, password || undefined)
    setBusy(null)
    if ('error' in res && res.error) { setMsg({ ok: false, text: res.error }); return }
    setSentAt(new Date().toISOString()); setReviewed(true)
    setMsg({ ok: true, text: `Welcome page sent to ${email}.` })
  }

  async function markReviewed() {
    setBusy('review')
    await markClientReviewedAction(clientId)
    setBusy(null); setReviewed(true)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      {!reviewed && (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-[13px] text-amber-800 flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Created from a signed agreement. Check the details, then set their login below.</span>
          <button onClick={markReviewed} disabled={busy !== null} className="text-xs font-semibold text-amber-900 underline underline-offset-2">
            {busy === 'review' ? 'Saving…' : 'Mark as reviewed'}
          </button>
        </div>
      )}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5"><KeyRound className="w-4 h-4 text-[#00250e]" /> Client portal &amp; welcome</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {sentAt
              ? `Welcome page sent ${new Date(sentAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`
              : hasLogin ? 'Login set. Welcome page not sent yet.' : 'Choose their login, then send the welcome page.'}
          </p>
        </div>
        {welcomeCode && (
          <a href={`/welcome/${welcomeCode}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800">
            View page <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={lbl}>Login email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value.trim())} placeholder="client@example.com" className={inp} />
        </div>
        <div>
          <label className={lbl}>Contact name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" className={inp} />
        </div>
        <div>
          <label className={lbl}>{hasLogin ? 'New password' : 'Password'}</label>
          <div className="flex gap-1.5">
            <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder={hasLogin ? 'Leave blank to keep' : 'At least 6 characters'} className={inp} />
            <button type="button" onClick={() => setPassword(makePassword())} title="Make a password"
              className="flex-shrink-0 border border-gray-200 rounded-lg px-2.5 text-gray-500 hover:text-gray-800 hover:border-gray-300">
              <Wand2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {msg && <p className={`mt-3 text-xs ${msg.ok ? 'text-emerald-700' : 'text-red-500'}`}>{msg.text}</p>}

      <div className="mt-4 flex flex-wrap gap-2 justify-end">
        <button onClick={save} disabled={busy !== null || !email || !name || !password}
          className="inline-flex items-center gap-1.5 text-sm font-semibold border border-gray-200 hover:border-gray-300 text-gray-800 rounded-lg px-3.5 py-2 disabled:opacity-40">
          {busy === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {hasLogin ? 'Update login' : 'Save login'}
        </button>
        <button onClick={send} disabled={busy !== null || (!hasLogin && !(email && name && password))}
          title={hasLogin || password ? undefined : 'Choose their login first'}
          className="inline-flex items-center gap-1.5 text-sm font-semibold bg-[#003314] hover:bg-[#00250e] text-white rounded-lg px-3.5 py-2 disabled:opacity-40">
          {busy === 'send' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} {sentAt ? 'Resend welcome page' : 'Send welcome page'}
        </button>
      </div>
      {hasLogin && (
        <p className="mt-2 text-[11px] text-gray-400 text-right">
          {password ? 'The password above is saved and included in the welcome email.' : 'Enter a new password to include it in the welcome email; otherwise it’s left out.'}
        </p>
      )}
    </div>
  )
}
