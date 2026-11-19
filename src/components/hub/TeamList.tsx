'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus } from './icons'
import { addCleaner, resendPack, setRegion, setCover, checkRemove, removeCleaner } from '@/actions/hub-team'
import { joinAnd } from '@/lib/hub/client-page'
import { REGIONS } from '@/lib/hub/figures'
import type { TeamMember } from '@/lib/hub/team'

type R = { ok: true; toast: string } | { ok: false; error: string }
type F = 'all' | 'none' | (typeof REGIONS)[number]['id']
const NO_DB = 'Couldn’t reach the hub. Check your connection and try again.'
const blank = { first: '', last: '', email: '', phone: '', region: '', leader: false, covered: false }
const known = (r: string | null) => !!r && REGIONS.some(x => x.id === r)
const Phone = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg>

export function TeamList({ team, tokens, initial }: { team: TeamMember[]; tokens: Record<string, string>; initial: F }) {
  const router = useRouter()
  const [, start] = useTransition()
  const [f, setF] = useState<F>(initial)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(blank)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  // Remove: the row being confirmed, and what they'd come off (null while checking)
  const [rm, setRm] = useState<{ key: string; text: string | null } | null>(null)
  const total = team.length
  const toSort = team.filter(c => !known(c.region)).length
  const sub = toSort ? `${total} registered cleaners · ${toSort} to sort into a region` : `${total} registered cleaners`
  const chips: [F, string, number][] = [['all', 'All', total], ...REGIONS.map(r => [r.id, r.name, team.filter(c => c.region === r.id).length] as [F, string, number]), ['none', 'To sort', toSort]]
  const shown = team.filter(c => f === 'all' || (f === 'none' ? !known(c.region) : c.region === f))
  const setK = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { const v = e.target.value; setForm(x => ({ ...x, [k]: v })); setErr('') }

  async function run(key: string, fn: () => Promise<R>, after?: () => void) {
    setBusy(key)
    try {
      const r = await fn()
      if (!r.ok) { if (key === 'add') setErr(r.error); else setToast(r.error); return }
      after?.()
      setRm(null)
      setToast(r.toast)
      start(() => router.refresh())
    } catch { if (key === 'add') setErr(NO_DB); else setToast(NO_DB) } finally { setBusy(null) }
  }

  async function askRemove(c: TeamMember) {
    const key = c.kind + c.id
    setRm({ key, text: null }); setToast('')
    try {
      const r = await checkRemove(c.kind, c.id)
      if (!r.ok) { setRm(null); setToast(r.error); return }
      const first = r.name.split(/\s+/)[0] || r.name
      const on = [...r.sites, ...r.homes]
      setRm(x => x && x.key === key ? {
        key,
        text: r.pack
          ? `Remove ${r.name}? The pack link they were sent stops working.`
          : `Remove ${r.name} from the team? Their login is deleted, so they can’t sign in.`
            + (on.length ? ` ${first} comes off ${joinAnd(on)}, so pick a new cleaner there.` : '')
            + ' Their past cleans, photos and signed pack stay.',
      } : x)
    } catch { setRm(null); setToast(NO_DB) }
  }

  return (
    <>
      <div className="titlerow">
        <h1 className="greet">Team</h1>
        {!adding && <button type="button" className="primary" onClick={() => { setAdding(true); setForm(blank); setErr('') }}><Plus />Add cleaner</button>}
      </div>
      <p className="sub"><span>{sub}</span></p>
      {adding && (
        <form className="addcard" aria-label="New cleaner" noValidate onSubmit={e => { e.preventDefault(); if (!busy) run('add', () => addCleaner(form), () => { setAdding(false); setF('all') }) }}>
          <h2 className="cgh">New cleaner</h2>
          <div className="fgrid">
            <label className="fld"><span>First name</span><input type="text" autoComplete="off" autoCapitalize="words" value={form.first} onChange={setK('first')} maxLength={60} /></label>
            <label className="fld"><span>Last name</span><input type="text" autoComplete="off" autoCapitalize="words" value={form.last} onChange={setK('last')} maxLength={80} /></label>
            <label className="fld"><span>Email (the pack is sent here)</span><input type="email" autoComplete="off" value={form.email} onChange={setK('email')} maxLength={200} /></label>
            <label className="fld"><span>Mobile</span><input type="tel" autoComplete="off" value={form.phone} onChange={setK('phone')} maxLength={20} /></label>
            <label className="fld"><span>Region</span>
              <select value={form.region} onChange={setK('region')}>
                <option value="">Choose a region</option>
                {REGIONS.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </label>
          </div>
          <label className="check"><input type="checkbox" checked={form.leader} onChange={e => setForm(x => ({ ...x, leader: e.target.checked }))} /><span>Team leader</span></label>
          <label className="check"><input type="checkbox" checked={form.covered} onChange={e => setForm(x => ({ ...x, covered: e.target.checked }))} /><span>Covered by my insurance (they don’t have their own public liability)</span></label>
          <p className="sheetsub">Adding them emails the subcontractor compliance pack from admin@corecleaning.services. They fill in their ABN{form.covered ? '' : ' and insurance details'} and sign once.{form.covered ? ' Their agreement says they’re covered under Core Cleaning’s policy and pay the excess on claims from their work.' : ''}</p>
          {err && <p className="ferr" role="alert">{err}</p>}
          <div className="sheetbtns">
            <button type="submit" className="btn call" disabled={busy === 'add'}>{busy === 'add' ? 'Adding…' : 'Add and send pack'}</button>
            <button type="button" className="btn log" onClick={() => { setAdding(false); setErr('') }}>Cancel</button>
          </div>
        </form>
      )}
      <div className="chips teamchips" role="group" aria-label="Show cleaners by region">
        {chips.map(([id, label, n]) => (
          <button key={id} type="button" className={f === id ? 'chip on' : 'chip'} aria-pressed={f === id} onClick={() => setF(id)}>{label} <span className="n">{n}</span></button>
        ))}
      </div>
      <div className="list">
        {shown.map(c => {
          const key = c.kind + c.id
          const tel = c.phone.replace(/[^\d+]/g, '')
          return (
            <div className="trow" key={key} data-testid="team-row">
              <div className="tmain">
                <div className="tname">{c.name}
                  {c.leader && <span className="tag wt">Team leader</span>}
                  {c.region === 'brisbane' && <span className="tag fu">Was Brisbane</span>}
                  {c.covered && <span className="tag fu">Covered by Core</span>}
                  {c.kind === 'k' ? <span className="tag warn">Pack not signed</span> : c.signed ? <span className="tag wt">Pack signed</span> : <span className="tag warn">Pack not signed</span>}
                </div>
                <div className="tcontact">{[c.phone, c.email].filter(Boolean).join(' · ')}</div>
                {c.details && <div className="tcontact">ABN {c.details.abn} · {c.details.covered ? 'Covered under Core Cleaning’s insurance' : `${c.details.insurer} policy ${c.details.policy}, expires ${c.details.expiry}`}</div>}
                <div className="tlinks">
                  {c.details && <Link className="linkbtn" href={`/hub/team/${c.id}`}>View signed pack</Link>}
                  {c.kind === 'k' && <>
                    <button type="button" className="linkbtn" disabled={busy === key + 'r'} onClick={() => run(key + 'r', () => resendPack(c.id))}>{busy === key + 'r' ? 'Sending…' : 'Resend pack'}</button>
                    {tokens[c.id] && <a className="linkbtn" href={`/pack/${tokens[c.id]}?preview=1`}>See what they get</a>}
                    <button type="button" className="linkbtn" aria-pressed={c.covered} disabled={busy === key + 'c'} onClick={() => run(key + 'c', () => setCover(c.id, !c.covered))}>{busy === key + 'c' ? 'Saving…' : c.covered ? 'Needs own insurance' : 'Cover with my insurance'}</button>
                  </>}
                  {rm?.key !== key && <button type="button" className="linkbtn danger" aria-label={'Remove ' + c.name} onClick={() => askRemove(c)}>Remove</button>}
                </div>
              </div>
              <div className="tact">
                <label className="tsel"><span className="sr">Region for {c.name}</span>
                  <select value={known(c.region) ? c.region! : ''} disabled={busy === key} onChange={e => { const v = e.target.value; run(key, () => setRegion(c.kind, c.id, v)) }}>
                    <option value="">Region not set</option>
                    {REGIONS.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </label>
                {tel && <a className="btn call" href={'tel:' + tel} aria-label={'Call ' + c.name}><Phone />Call</a>}
              </div>
              {rm?.key === key && (
                <div className="inlineconfirm tconfirm" role="group" aria-label={'Remove ' + c.name}>
                  <span>{rm.text ?? 'Checking what they’re on…'}</span>
                  <button type="button" className="btn call dangerfill" disabled={rm.text === null || busy === key + 'x'} onClick={() => run(key + 'x', () => removeCleaner(c.kind, c.id))}>{busy === key + 'x' ? 'Removing…' : 'Yes, remove'}</button>
                  <button type="button" className="btn log" disabled={busy === key + 'x'} onClick={() => setRm(null)}>Keep them</button>
                </div>
              )}
            </div>
          )
        })}
        {!shown.length && <div className="empty">No cleaners here.</div>}
      </div>
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button type="button" className="undo" onClick={() => setToast('')} aria-label="Dismiss">OK</button>
        </div>
      )}
    </>
  )
}
