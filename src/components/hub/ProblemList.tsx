'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { markProblemFixed, reopenProblem } from '@/actions/hub-problems'

export interface Problem {
  id: string
  body: string
  createdAt: string
  fixed: boolean
  resolvedAt: string | null
  where: string
  cleaner: string
  phone: string
  cleanDate: string | null
}

const when = (iso: string) =>
  new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Brisbane', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
const day = (d: string) =>
  new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(d + 'T00:00:00Z'))

export function ProblemList({ problems, initial }: { problems: Problem[]; initial: 'open' | 'fixed' }) {
  const [view, setView] = useState<'open' | 'fixed'>(initial)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [, start] = useTransition()
  const router = useRouter()
  const open = problems.filter(p => !p.fixed)
  const fixed = problems.filter(p => p.fixed)
  const shown = view === 'open' ? open : fixed

  function act(id: string, fn: (id: string) => Promise<{ ok: boolean; error?: string }>) {
    setError('')
    setBusy(id)
    start(async () => {
      try {
        const r = await fn(id)
        if (!r.ok) setError(r.error ?? 'Couldn’t save that. Please try again.')
        router.refresh()
      } catch {
        setError('Couldn’t reach the hub. Check your connection and try again.')
      } finally {
        setBusy(null)
      }
    })
  }

  return (
    <>
      <div className="chips" role="group" aria-label="Show">
        {(['open', 'fixed'] as const).map(v => (
          <button key={v} type="button" className={view === v ? 'chip on' : 'chip'} aria-pressed={view === v} onClick={() => { setView(v); setError('') }}>
            {v === 'open' ? 'Open' : 'Fixed'} <span className="n">{v === 'open' ? open.length : fixed.length}</span>
          </button>
        ))}
      </div>
      {error && <p className="err" role="alert">{error}</p>}
      <div className="problist">
        {shown.length === 0 && (
          <p className="empty">{view === 'open' ? 'Nothing open. When a cleaner reports a problem it shows up here.' : 'Nothing marked fixed yet.'}</p>
        )}
        {shown.map(p => (
          <article key={p.id} className={p.fixed ? 'probcard fixed' : 'probcard'}>
            <div className="probhead"><strong>{p.where}</strong></div>
            <div className="probmeta">
              {p.cleaner} · reported {when(p.createdAt)}{p.cleanDate ? ` · clean on ${day(p.cleanDate)}` : ''}{p.fixed && p.resolvedAt ? ` · fixed ${when(p.resolvedAt)}` : ''}
            </div>
            <p className="probtext">{p.body}</p>
            <div className="probacts">
              {p.fixed
                ? <button type="button" className="btn ghost" disabled={busy === p.id} onClick={() => act(p.id, reopenProblem)}>{busy === p.id ? 'Reopening…' : 'Reopen'}</button>
                : <button type="button" className="btn" disabled={busy === p.id} onClick={() => act(p.id, markProblemFixed)}>{busy === p.id ? 'Saving…' : 'Mark fixed'}</button>}
              {p.phone && <a className="btn ghost" href={`tel:${p.phone.replace(/[^\d+]/g, '')}`}>Call {p.cleaner.split(' ')[0]}</a>}
            </div>
          </article>
        ))}
      </div>
    </>
  )
}
