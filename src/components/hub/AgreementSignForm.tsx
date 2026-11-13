'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AgreementDoc } from './AgreementDoc'
import { clientSignAgreement } from '@/actions/hub-comm-agreements'
import { AS_REQS, AS_TIMES, P_FREQ, WDAYS, agView, dLong, tidy, type Agr, type SignDetails, type SignForm } from '@/lib/hub/proposals'

/** The client's signing page: their details (page 02), live particulars, Schedule 1, terms, and the sign box. */
export function AgreementSignForm({ d, today, initial, justAccepted }: { d: Agr; today: string; initial: SignForm; justAccepted: boolean }) {
  const router = useRouter()
  const [f, setF] = useState<SignForm>(initial)
  const [err, setErr] = useState('')
  const [done, setDone] = useState('')
  const [busy, start] = useTransition()
  const spec = d.atype === 'spec', p = d.snap?.prop
  const set = (k: keyof SignForm) => (e: { target: { value: string } }) => { const v = e.target.value; setF(x => ({ ...x, [k]: v })); setErr('') }
  const det: Partial<SignDetails> = { legal: f.legal, abn: f.abn, address: f.address, start: f.start, time: f.time, po: f.po, accounts: f.accounts, days: WDAYS.filter(x => f.days[x[0]]).map(x => x[0]) }
  const v = agView(d, today, det)
  const daysLabel = p && P_FREQ[p.freq] ? `Preferred cleaning days (your proposal is ${P_FREQ[p.freq].word})` : 'Preferred cleaning days'

  if (done) return <div className="addcard pubdone" role="status"><h1 className="nch">Signed. Thank you.</h1><p className="nchint">{done}</p></div>

  function sign() {
    setErr('')
    start(async () => {
      try {
        const r = await clientSignAgreement(d.code, f)
        if (!r.ok) { setErr(r.error); return }
        setDone(r.message)
        window.scrollTo({ top: 0 })
        setTimeout(() => router.refresh(), 2500)
      } catch { setErr('That didn’t go through. Check your connection and try again.') }
    })
  }

  const fld = (k: keyof SignForm, label: string, cls: string, extra: Record<string, unknown> = {}) => (
    <label className={'fld ' + cls}><span>{label}</span><input type="text" value={String(f[k] ?? '')} onChange={set(k)} {...extra} /></label>
  )

  const details = (
    <>
      <div className="pkick g">Your details</div>
      <h2 className="ph2">A few details to get you started.</h2>
      <p className="pp">These go into your agreement and help us set up your {spec ? 'works' : 'first clean'}. Boxes marked * are needed.</p>
      <div role="form" aria-label="Your details" className="ncform asform">
        <h3 className="ash">Who is signing</h3>
        <div className="ncgrid">
          {fld('name', 'Full name *', 'half', { autoComplete: 'name' })}
          {fld('position', 'Position *', 'half', { autoComplete: 'organization-title', placeholder: 'e.g. Practice Manager' })}
          {fld('phone', 'Mobile *', 'half', { type: 'tel', autoComplete: 'tel', placeholder: '04XX XXX XXX' })}
          {fld('email', 'Email *', 'half', { type: 'email', autoComplete: 'email', autoCapitalize: 'off' })}
        </div>
        <h3 className="ash">Business and billing</h3>
        <div className="ncgrid">
          {fld('legal', 'Business legal name *', 'half', { autoComplete: 'organization', placeholder: 'As it appears on your ABN' })}
          {fld('abn', 'ABN', 'half', { inputMode: 'numeric', placeholder: '11 digits' })}
          {fld('accounts', 'Email for invoices *', 'half', { type: 'email', autoCapitalize: 'off' })}
          {fld('po', 'Purchase order number (if you use them)', 'half')}
        </div>
        <h3 className="ash">Your site</h3>
        <div className="ncgrid">
          {fld('address', 'Site address *', 'span2', { autoComplete: 'street-address' })}
          {fld('siteName', 'On-site contact name', 'half', { placeholder: 'If different to you' })}
          {fld('sitePhone', 'On-site contact phone', 'half', { type: 'tel' })}
          <label className="fld span2"><span>Site access details *</span><textarea rows={3} placeholder="Keys or swipe card, alarm instructions, which door to use, parking" value={f.access} onChange={set('access')} /><span className="fhint">Only the cleaners assigned to your site can see this.</span></label>
        </div>
        <h3 className="ash">{spec ? 'Works date' : 'Starting'}</h3>
        <div className="ncgrid">
          <label className="fld half"><span>{spec ? 'Works date' : 'Preferred first clean date'} *</span><input type="date" min={today} value={f.start} onChange={set('start')} /></label>
          {!spec && (
            <label className="fld half"><span>Preferred start time</span>
              <select value={f.time} onChange={set('time')}>
                <option value="">No preference</option>
                {AS_TIMES.map(([val, l]) => <option key={val} value={val}>{l}</option>)}
              </select>
            </label>
          )}
        </div>
        {!spec && (
          <div className="fld"><span>{daysLabel}</span>
            <div className="days" role="group" aria-label="Preferred cleaning days">
              {WDAYS.map(([k, l, full]) => {
                const on = !!f.days[k]
                return <button key={k} type="button" className={on ? 'day on' : 'day'} aria-pressed={on} aria-label={full} onClick={() => { setF(x => { const days = { ...x.days }; if (days[k]) delete days[k]; else days[k] = true; return { ...x, days } }); setErr('') }}>{l}</button>
              })}
            </div>
          </div>
        )}
        <h3 className="ash">Anything you need from us?</h3>
        <div className="asreqs">
          {AS_REQS.map(([k, l]) => (
            <label className="check presetbox" key={k}><input type="checkbox" checked={!!f.reqs[k]} onChange={() => setF(x => { const reqs = { ...x.reqs }; if (reqs[k]) delete reqs[k]; else reqs[k] = true; return { ...x, reqs } })} /><span>{l}</span></label>
          ))}
        </div>
        <label className="fld"><span>Anything else we should know?</span><textarea rows={2} placeholder="e.g. Rooms to skip, sensitive equipment, pets on site" value={f.notes} onChange={set('notes')} /></label>
      </div>
    </>
  )

  const signatures = (
    <>
      <div className="pkick g">Signatures</div>
      <h2 className="ph2">Sign to get started.</h2>
      <div className="pfootsig">
        <div><div className="pkick g">For Core Cleaning</div><div className="psig line">Laith Humadi</div><div className="psmall split"><span>Laith Humadi, Director</span><span>{v.date}</span></div></div>
        <div><div className="pkick g">For {d.client}</div><div className="psig line">{tidy(f.sig) || ' '}</div><div className="psmall split"><span>{[tidy(f.name), tidy(f.position)].filter(Boolean).join(', ') || 'Name and position'}</span><span>{dLong(today)}</span></div></div>
      </div>
      <div className="stackform assign">
        <label className="fld"><span>Type your full name to sign</span><input className="sig" type="text" autoComplete="off" value={f.sig} onChange={set('sig')} /></label>
        <label className="check"><input type="checkbox" checked={f.agree} onChange={e => { const on = e.target.checked; setF(x => ({ ...x, agree: on })); setErr('') }} /><span>I have read and agree to this agreement, and I am authorised to sign it for {d.client}.</span></label>
        {err && <p className="ferr" role="alert">{err}</p>}
        <button type="button" className="btn call" disabled={busy} onClick={sign}>{busy ? 'Signing…' : 'Sign agreement'}</button>
      </div>
    </>
  )

  return (
    <>
      {justAccepted && <p className="agstatus ok asbanner">Thank you, the proposal is accepted. The last step is your {spec ? 'works agreement' : 'service agreement'}: add your details, read the terms and sign at the bottom.</p>}
      <AgreementDoc v={v} details={details} signatures={signatures} />
    </>
  )
}
