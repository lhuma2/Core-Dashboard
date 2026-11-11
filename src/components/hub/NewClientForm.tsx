'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setFlash } from '@/lib/hub/flash'
import { createCommercialClient } from '@/actions/hub-clients'
import {
  DAYS, STATES, EVERY_OPTS, EXTRA_KINDS, EXTRA_FREQS, MAX_SITES, MAX_EXTRAS,
  blankNc, blankSite, blankSvc, blankExtra, svcMoney, extraMoney, extraName, svcSummary, validateNewClient,
  type NcForm, type NcSvc, type NcExtra, type NcSite,
} from '@/lib/hub/new-client'

export interface TeamMember { id: string; name: string; region: string | null; leader: boolean; signed: boolean }

const REGION_NAME: Record<string, string> = { north: 'North Brisbane', south: 'South Brisbane', ipswich: 'Ipswich', gold_coast: 'Gold Coast', brisbane: 'Brisbane' }
const REGION_ORDER: Record<string, number> = { north: 0, south: 1, ipswich: 2, gold_coast: 3 }
const initials = (n: string) => { const p = n.trim().split(/\s+/); return ((p[0] ?? '').charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : '')).toUpperCase() }
const regionLine = (t: TeamMember) => (REGION_NAME[t.region ?? ''] ?? 'No region') + (t.leader ? ' · Team leader' : '')

const Plus = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
const Person = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="10" cy="8" r="4" /><path d="M3 20c0-3.5 3-6 7-6s7 2.5 7 6M19 8v6M16 11h6" /></svg>
const Tick = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
const Bldg = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="1.5" /><path d="M9 7h1M14 7h1M9 11h1M14 11h1M10 21v-3h4v3" /></svg>
const Pin = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>

export function NewClientForm({ team, existing, today }: { team: TeamMember[]; existing: { name: string; status: string | null; resume_on: string | null }[]; today: string }) {
  const [nc, setNc] = useState<NcForm>(blankNc)
  const [picking, setPicking] = useState<number | null>(null)
  const [err, setErr] = useState('')
  const [saving, start] = useTransition()
  const router = useRouter()
  const multi = nc.siteType === 'multi'
  const teamSorted = [...team].sort((a, b) => (REGION_ORDER[a.region ?? ''] ?? 9) - (REGION_ORDER[b.region ?? ''] ?? 9) || a.name.localeCompare(b.name))

  const upd = (patch: Partial<NcForm>) => { setNc(cur => ({ ...cur, ...patch })); setErr('') }
  const field = (k: keyof NcForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    let v = e.target.value
    if (k === 'postcode') v = v.replace(/[^0-9]/g, '').slice(0, 4)
    upd({ [k]: v } as Partial<NcForm>)
  }
  const updSvc = (i: number, fn: (s: NcSvc) => NcSvc) => { setNc(cur => ({ ...cur, svcs: cur.svcs.map((s, j) => (j === i ? fn(s) : s)) })); setErr('') }
  const svcField = (i: number, k: 'start' | 'finish' | 'first' | 'cost' | 'price' | 'access' | 'every') => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { const v = e.target.value; updSvc(i, s => ({ ...s, [k]: v })) }
  const siteField = (i: number, k: keyof NcSite) => (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value
    if (k === 'postcode') v = v.replace(/[^0-9]/g, '').slice(0, 4)
    setNc(cur => ({ ...cur, sites: cur.sites.map((s, j) => (j === i ? { ...s, [k]: v } : s)) })); setErr('')
  }
  const updExtra = (i: number, xi: number, patch: Partial<NcExtra>) => updSvc(i, s => ({ ...s, extras: s.extras.map((x, j) => (j === xi ? { ...x, ...patch } : x)) }))

  function addSite() {
    if (nc.sites.length >= MAX_SITES) { setErr('That is the most sites one client can have here (20).'); return }
    upd({ sites: [...nc.sites, blankSite()], svcs: [...nc.svcs, blankSvc()] })
  }
  function removeSite(i: number) {
    if (nc.sites.length <= 2) return
    if (picking !== null) setPicking(picking === i ? null : picking > i ? picking - 1 : picking)
    upd({ sites: nc.sites.filter((_, j) => j !== i), svcs: nc.svcs.filter((_, j) => j !== i) })
  }

  function save() {
    if (saving) return
    // Same checks as the server, so most mistakes show straight away.
    const r = validateNewClient(nc, today, team.map(t => ({ id: t.id, signed: t.signed })), existing.map(c => ({ name: c.name, status: c.status, resume_on: c.resume_on })))
    if (!r.ok) { setErr(r.error); return }
    setErr('')
    start(async () => {
      try {
        const res = await createCommercialClient(nc)
        if (!res.ok) { setErr(res.error); return }
        setFlash(res.toast)
        router.push('/hub/commercial')
        router.refresh()
      } catch {
        setErr('Couldn’t reach the hub. Check your connection and try again. Nothing was saved.')
      }
    })
  }

  function svcSection(i: number, title: string) {
    const sv = nc.svcs[i]
    const m = svcMoney(sv)
    const assigned = sv.cleaners.map(id => team.find(t => t.id === id)).filter((t): t is TeamMember => !!t)
    const open = picking === i
    return (
      <section className="svccard" aria-label={title}>
        <h2 className="nch">{title}</h2>
        <div className="fld">
          <span>Cleaning days</span>
          <div className="days" role="group" aria-label={`Cleaning days for ${title}`}>
            {DAYS.map(([k, short, full]) => {
              const on = !!sv.days[k]
              return <button key={k} type="button" className={on ? 'day on' : 'day'} aria-pressed={on} aria-label={full} onClick={() => updSvc(i, s => ({ ...s, days: { ...s.days, [k]: !s.days[k] } }))}>{short}</button>
            })}
          </div>
        </div>
        <div className="ncgrid">
          <label className="fld half"><span>Start time</span><input type="time" value={sv.start} onChange={svcField(i, 'start')} /></label>
          <label className="fld half"><span>Finish time (optional)</span><input type="time" value={sv.finish} onChange={svcField(i, 'finish')} /></label>
          <label className="fld half"><span>First clean date</span><input type="date" min={today} value={sv.first} onChange={svcField(i, 'first')} /></label>
          <label className="fld half"><span>How often</span>
            <select value={sv.every} onChange={svcField(i, 'every')}>{EVERY_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </label>
          <div className="fld half"><span>Summary</span><div className="freqread">{svcSummary(sv)}</div></div>
          {sv.every === 'fortnightly' && <p className="fhint span2">Cleaned every second week, counting from the first clean date.</p>}
          {sv.every === 'monthly' && <p className="fhint span2">Cleaned once a month on the same week as the first clean, e.g. the 2nd Saturday.</p>}
          <label className="fld half"><span>Total cleaner cost per visit ($)</span><input type="text" inputMode="decimal" autoComplete="off" placeholder="e.g. 120" value={sv.cost} onChange={svcField(i, 'cost')} /></label>
          <label className="fld half"><span>Client price per visit ($, ex GST)</span><input type="text" inputMode="decimal" autoComplete="off" placeholder="e.g. 180" value={sv.price} onChange={svcField(i, 'price')} /></label>
        </div>
        {m && <p className={m.cls}>{m.text}</p>}

        <div className="fld">
          <span>Cleaners</span>
          {assigned.map(t => (
            <div key={t.id} className="assigned">
              <span className="avatar sm" aria-hidden="true">{initials(t.name)}</span>
              <span className="asname"><strong>{t.name}</strong><span>{regionLine(t)}</span></span>
              <button type="button" className="linkbtn danger" aria-label={`Remove ${t.name} from this job`} onClick={() => updSvc(i, s => ({ ...s, cleaners: s.cleaners.filter(id => id !== t.id) }))}>Remove</button>
            </div>
          ))}
          {!open ? (
            <button type="button" className="btn log assignbtn" aria-expanded="false" onClick={() => setPicking(i)}><Person />{assigned.length ? 'Add or change cleaners' : 'Assign cleaners'}</button>
          ) : (
            <div className="picker" role="listbox" aria-multiselectable="true" aria-label="Choose cleaners">
              <p className="pickhint">Tap everyone working this job. Tap again to take them off.</p>
              {teamSorted.map(t => {
                const sel = sv.cleaners.includes(t.id)
                return (
                  <button key={t.id} type="button" role="option" className={'pick' + (sel ? ' on' : '') + (t.signed ? '' : ' off')} aria-selected={sel} aria-disabled={!t.signed}
                    onClick={() => {
                      if (!t.signed && !sel) { setErr(`${t.name.split(' ')[0]} can’t be assigned until they sign the compliance pack.`); return }
                      updSvc(i, s => ({ ...s, cleaners: sel ? s.cleaners.filter(id => id !== t.id) : [...s.cleaners, t.id] }))
                    }}>
                    <span className="avatar sm" aria-hidden="true">{initials(t.name)}</span>
                    <span className="asname"><strong>{t.name}</strong><span>{regionLine(t)}{t.signed ? '' : ' · Pack not signed yet'}</span></span>
                    <span className={sel ? 'tick on' : 'tick'} aria-hidden="true"><Tick /></span>
                  </button>
                )
              })}
              {!teamSorted.length && <p className="pickhint">No cleaners in the team yet.</p>}
              <button type="button" className="btn call pickdone" onClick={() => setPicking(null)}>{assigned.length ? `Done (${assigned.length} selected)` : 'Done'}</button>
            </div>
          )}
        </div>

        <label className="fld"><span>Access details (only the assigned cleaners see this)</span>
          <textarea rows={3} maxLength={2000} placeholder="Keys or swipe card, alarm instructions, parking, which door to use, who to contact on site" value={sv.access} onChange={svcField(i, 'access')} />
        </label>

        <div className="fld">
          <span>Additional services</span>
          {sv.extras.map((ex, xi) => {
            const nm = extraName(ex), em = extraMoney(ex)
            return (
              <div key={xi} className="extracard">
                <div className="sitehead"><strong>{nm || `Service ${xi + 1}`}</strong>
                  <button type="button" className="linkbtn danger" aria-label={`Remove ${nm || 'service ' + (xi + 1)}`} onClick={() => updSvc(i, s => ({ ...s, extras: s.extras.filter((_, j) => j !== xi) }))}>Remove</button>
                </div>
                <div className="ncgrid">
                  <label className="fld half"><span>Service</span>
                    <select value={ex.kind} onChange={e => updExtra(i, xi, { kind: e.target.value })}>
                      <option value="">Choose a service</option>
                      {EXTRA_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </label>
                  <label className="fld half"><span>Frequency</span>
                    <select value={ex.freq} onChange={e => updExtra(i, xi, { freq: e.target.value })}>
                      <option value="">Choose how often</option>
                      {EXTRA_FREQS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </label>
                  {ex.kind === 'Custom' && <label className="fld span2"><span>Custom service name</span><input type="text" autoComplete="off" maxLength={200} placeholder="e.g. High dusting" value={ex.custom} onChange={e => updExtra(i, xi, { custom: e.target.value })} /></label>}
                  <label className="fld half"><span>My charge per visit ($, ex GST)</span><input type="text" inputMode="decimal" autoComplete="off" placeholder="e.g. 350" value={ex.price} onChange={e => updExtra(i, xi, { price: e.target.value })} /></label>
                  <label className="fld half"><span>Cleaner cost per visit ($)</span><input type="text" inputMode="decimal" autoComplete="off" placeholder="e.g. 220" value={ex.cost} onChange={e => updExtra(i, xi, { cost: e.target.value })} /></label>
                </div>
                {em && <p className={em.cls}>{em.text}</p>}
              </div>
            )
          })}
          {sv.extras.length < MAX_EXTRAS && (
            <button type="button" className="btn log addsite" onClick={() => updSvc(i, s => ({ ...s, extras: [...s.extras, blankExtra()] }))}><Plus />Add a service</button>
          )}
        </div>
      </section>
    )
  }

  return (
    <div role="form" aria-label="New client" className="addcard ncform">
      <h2 className="nch">Business details</h2>
      <div className="ncgrid">
        <label className="fld span2"><span>Business name <span className="req" aria-hidden="true">*</span><span className="sr">(required)</span></span><input type="text" autoComplete="off" maxLength={200} placeholder="e.g. Mitchelton Dental Centre" value={nc.biz} onChange={field('biz')} /></label>
        <label className="fld half"><span>Contact name</span><input type="text" autoComplete="off" maxLength={200} placeholder="e.g. Jodie Smith" value={nc.contact} onChange={field('contact')} /></label>
        <label className="fld half"><span>Contact phone</span><input type="tel" autoComplete="off" maxLength={30} placeholder="07 XXXX XXXX" value={nc.phone} onChange={field('phone')} /></label>
        <label className="fld span2"><span>Contact email</span><input type="email" autoComplete="off" autoCapitalize="off" maxLength={254} placeholder="contact@business.com.au" value={nc.email} onChange={field('email')} /></label>
        <label className="fld span2"><span>Street address</span><input type="text" autoComplete="off" maxLength={200} placeholder="123 Example Street" value={nc.street} onChange={field('street')} /></label>
        <label className="fld subf"><span>Suburb</span><input type="text" autoComplete="off" maxLength={100} placeholder="e.g. Fortitude Valley" value={nc.suburb} onChange={field('suburb')} /></label>
        <label className="fld pc"><span>Postcode</span><input type="text" inputMode="numeric" maxLength={4} autoComplete="off" placeholder="4000" value={nc.postcode} onChange={field('postcode')} /></label>
        <label className="fld half"><span>State</span>
          <select value={nc.state} onChange={field('state')}>{STATES.map(s => <option key={s} value={s}>{s}</option>)}</select>
        </label>
      </div>

      <h2 className="nch">Site type</h2>
      <p className="nchint">Does this client have one location or multiple separate sites?</p>
      <div className="stypes" role="radiogroup" aria-label="Site type">
        <button type="button" role="radio" className={multi ? 'stype' : 'stype on'} aria-checked={!multi} onClick={() => upd({ siteType: 'single' })}>
          <span className="sticon"><Bldg /></span><span className="sttext"><strong>Single site</strong><span>One location</span></span>
        </button>
        <button type="button" role="radio" className={multi ? 'stype on' : 'stype'} aria-checked={multi} onClick={() => upd({ siteType: 'multi' })}>
          <span className="sticon"><Pin /></span><span className="sttext"><strong>Multi-site</strong><span>Multiple locations</span></span>
        </button>
      </div>
      {multi && <p className="nchint">The address above is the main or billing address. Add each site the team cleans.</p>}

      {multi
        ? nc.sites.map((s, i) => (
          <div key={i} className="ncrow pair">
            <div className="sitecard">
              <div className="sitehead"><strong>Site {i + 1}</strong>
                {nc.sites.length > 2 && <button type="button" className="linkbtn" aria-label={`Remove site ${i + 1}`} onClick={() => removeSite(i)}>Remove</button>}
              </div>
              <div className="ncgrid">
                <label className="fld span2"><span>Site name</span><input type="text" autoComplete="off" maxLength={200} placeholder="e.g. Chermside clinic" value={s.name} onChange={siteField(i, 'name')} /></label>
                <label className="fld span2"><span>Street address</span><input type="text" autoComplete="off" maxLength={200} placeholder="123 Example Street" value={s.street} onChange={siteField(i, 'street')} /></label>
                <label className="fld subf"><span>Suburb</span><input type="text" autoComplete="off" maxLength={100} placeholder="e.g. Chermside" value={s.suburb} onChange={siteField(i, 'suburb')} /></label>
                <label className="fld pc"><span>Postcode</span><input type="text" inputMode="numeric" maxLength={4} autoComplete="off" placeholder="4032" value={s.postcode} onChange={siteField(i, 'postcode')} /></label>
              </div>
            </div>
            {svcSection(i, `Site ${i + 1}${s.name.trim() ? ': ' + s.name.trim() : ''} service`)}
          </div>
        ))
        : <div className="ncrow">{svcSection(0, 'Service details')}</div>}

      {multi && <button type="button" className="btn log addsite" onClick={addSite}><Plus />Add another site</button>}

      {err && <p className="ferr" role="alert">{err}</p>}
      <div className="sheetbtns">
        <button type="button" className="btn call" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save client'}</button>
        <button type="button" className="btn log" onClick={() => router.push('/hub/commercial')} disabled={saving}>Cancel</button>
      </div>
    </div>
  )
}
