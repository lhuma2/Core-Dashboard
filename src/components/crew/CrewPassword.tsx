'use client'
import { useState } from 'react'
import { savePassword } from '@/actions/crew'
import { setFlash } from '@/lib/hub/flash'

/** First login: swap the starter password for one only you know (mock-up rules, word for word). */
export function CrewPassword({ first }: { first: string }) {
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [show, setShow] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const rules = [
    { ok: p1.length >= 8, text: 'At least 8 characters' },
    { ok: !!p1 && !p1.toLowerCase().includes(first.toLowerCase()), text: 'Not your first name' },
    { ok: !!p1 && p1 === p2, text: 'Both boxes match' },
  ]

  async function save(e?: React.FormEvent) {
    e?.preventDefault()
    if (busy) return
    if (p1.length < 8) { setErr('Use at least 8 characters.'); return }
    if (p1.toLowerCase().includes(first.toLowerCase())) { setErr('Don’t use your first name in your password.'); return }
    if (p1 !== p2) { setErr('The two passwords don’t match.'); return }
    setBusy(true); setErr('')
    try {
      const r = await savePassword(p1, p2)
      if (!r.ok) { setErr(r.error); setBusy(false); return }
      setFlash('Password saved. Use it next time you log in.')
      window.location.replace('/cleaner/app')
    } catch { setErr('That didn’t save. Check your signal and try again.'); setBusy(false) }
  }

  return (
    <form className="stack" onSubmit={save} noValidate>
      <div>
        <h1 className="h1">Choose your own password</h1>
        <p className="hint">Welcome, {first}. This is your first login, so swap the starter password for one only you know.</p>
      </div>
      <label className="fld"><span>New password</span>
        <span className="pwrow">
          <input type={show ? 'text' : 'password'} autoComplete="new-password" autoCapitalize="off" autoCorrect="off" value={p1} onChange={e => { setP1(e.target.value); setErr('') }} />
          <button type="button" className="linkbtn" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide passwords' : 'Show passwords'}>{show ? 'Hide' : 'Show'}</button>
        </span>
      </label>
      <label className="fld"><span>Type it again</span>
        <input type={show ? 'text' : 'password'} autoComplete="new-password" autoCapitalize="off" autoCorrect="off" value={p2} onChange={e => { setP2(e.target.value); setErr('') }} />
      </label>
      <ul className="rules">
        {rules.map(r => <li key={r.text} className={r.ok ? 'ok' : ''}><span className="dot" aria-hidden="true" />{r.text}<span className="sr">{r.ok ? ' (done)' : ' (not yet)'}</span></li>)}
      </ul>
      {err && <p className="ferr" role="alert">{err}</p>}
      <button type="submit" className="btn main" disabled={busy}>{busy ? 'Saving…' : 'Save and continue'}</button>
    </form>
  )
}
