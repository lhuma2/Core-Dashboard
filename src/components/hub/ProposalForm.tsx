'use client'

import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Back, Close, Plus } from './icons'
import { saveProposal } from '@/actions/hub-proposals'
import { scopeUploadUrl, readScope } from '@/actions/hub-scope'
import { setFlash } from '@/lib/hub/flash'
import {
  ADD_ADJ, ADD_FREQ_OPTS, ADDON_KINDS, JOB_KINDS, P_FREQ, SPEC_METHODS, WHEN_OPTS, addItems, addName, addPresetSow, blankAddon, blankJob,
  checkProp, dLong, dShort, draftCheck, fmt$, fmt2, jobName, pfMonthly, propTotal, removePresetSow, tidy,
  type FreqKey, type Pf, type PresetScope, type SowHead, type WhenKey, type WinKey,
} from '@/lib/hub/proposals'
import type { PickClient, PickLead } from '@/lib/hub/documents-data'

export interface OpenReq { id: string; clientId: string; client: string; service: string; created: string }

const X = () => <Close />

export function ProposalForm({ initial, presets, leads, clients, requests, today, backHref, backLabel, heading }: {
  initial: Pf; presets: PresetScope[]; leads: PickLead[]; clients: PickClient[]; requests: OpenReq[]; today: string
  backHref: string; backLabel: string; heading: string
}) {
  const router = useRouter()
  const [pf, setPf] = useState<Pf>(initial)
  const [pick, setPick] = useState('')
  const [err, setErr] = useState('')
  const [reading, setReading] = useState('')
  const [busy, start] = useTransition()
  const token = useRef(0)
  const upd = (fn: (x: Pf) => void) => { setPf(cur => { const c: Pf = JSON.parse(JSON.stringify(cur)); fn(c); return c }); setErr('') }
  const set = <K extends keyof Pf>(k: K) => (e: { target: { value: string } }) => { const v = e.target.value; upd(x => { (x as any)[k] = v }) }
  const comm = pf.ptype === 'comm'

  const fromOpts = [...leads.map(l => ({ value: 'l:' + l.id, label: 'Lead: ' + l.company })), ...clients.filter(c => c.status !== 'ended').map(c => ({ value: 'c:' + c.id, label: 'Client: ' + c.name }))]
  function fillFrom(v: string) {
    setPick(v)
    upd(x => {
      if (v.startsWith('l:')) { const l = leads.find(y => 'l:' + y.id === v); if (l) { x.biz = l.company; x.contact = l.name; x.email = l.email; x.address = l.address; x.leadId = l.id; x.clientId = null } }
      else if (v.startsWith('c:')) { const c = clients.find(y => 'c:' + y.id === v); if (c) { x.biz = c.name; x.contact = c.contact; x.email = c.email; x.address = c.address; x.clientId = c.id; x.leadId = null } }
    })
  }
  const linked = pf.requestId ? requests.find(r => r.id === pf.requestId) : null
  const suggest = !pf.requestId && pf.clientId ? requests.find(r => r.clientId === pf.clientId) : null

  const monthly = pfMonthly(pf), total = propTotal(pf)

  async function upload(f: File | undefined) {
    if (!f) return
    if (!(f.type === 'application/pdf' || /^image\//.test(f.type || ''))) { setErr('Upload the scope as a screenshot or a PDF.'); return }
    if (f.size > 20 * 1024 * 1024) { setErr('That file is over 20 MB.'); return }
    const t = ++token.current
    setReading(f.name || 'the scope'); setErr('')
    try {
      const u = await scopeUploadUrl(f.type, f.size)
      if (!u.ok) { if (t === token.current) { setReading(''); setErr(u.error) } return }
      const put = await fetch(u.url, { method: 'PUT', headers: { 'content-type': f.type, 'x-upsert': 'true' }, body: f })
      if (!put.ok) { if (t === token.current) { setReading(''); setErr('The upload didn’t go through. Check your connection and try again.') } return }
      const r = await readScope(u.path, f.type)
      if (t !== token.current) return
      setReading('')
      if (!r.ok) { setErr(r.error); return }
      upd(x => { x.presets = {}; x.uploadName = f.name || 'the scope'; x.sow = r.sow.map(h => ({ heading: h.heading, src: [], items: h.items.map(text => ({ text, orig: text, src: [] })) })) })
    } catch { if (t === token.current) { setReading(''); setErr('The upload didn’t go through. Check your connection and try again.') } }
  }

  function save(mode: 'draft' | 'preview') {
    if (reading) { setErr('The uploaded scope is still being read. Give it a moment.'); return }
    const bad = mode === 'draft' ? draftCheck(pf) : checkProp(pf, today)
    if (bad) { setErr(bad); return }
    start(async () => {
      try {
        const r = await saveProposal(pf, mode)
        if (!r.ok) { setErr(r.error); return }
        if (mode === 'draft') { setFlash(r.toast); router.push(backHref); router.refresh() }
        else router.push(`/hub/commercial/documents/proposals/${r.id}${backHref.includes('requests') ? '?from=requests' : ''}`)
      } catch { setErr('Couldn’t reach the hub. Check your connection and try again.') }
    })
  }

  const sowView = (h: SowHead, hi: number) => (
    <div className="sowsec" key={hi}>
      <div className="sowhedit">
        <label className="fld grow"><span className="sr">Heading</span><input type="text" value={h.heading} aria-label="Heading" onChange={e => { const v = e.target.value; upd(x => { x.sow[hi].heading = v }) }} /></label>
        <button type="button" className="linkbtn danger" aria-label={'Remove heading ' + (h.heading || hi + 1) + ' and its tasks'} onClick={() => upd(x => { x.sow.splice(hi, 1) })}>Remove heading</button>
      </div>
      {h.items.map((it, ii) => (
        <div className="sowiedit" key={ii}>
          <input type="text" className="sowin" value={it.text} aria-label="Task" onChange={e => { const v = e.target.value; upd(x => { x.sow[hi].items[ii].text = v }) }} />
          <button type="button" className="iconbtn" aria-label={'Remove task ' + (it.text || ii + 1)} onClick={() => upd(x => { x.sow[hi].items.splice(ii, 1) })}><X /></button>
        </div>
      ))}
      <button type="button" className="linkbtn" onClick={() => upd(x => { if (x.sow[hi].items.length < 40) x.sow[hi].items.push({ text: '', orig: '', src: [] }) })}>+ Add task</button>
    </div>
  )

  return (
    <>
      <Link className="back" href={backHref}><Back /> {backLabel}</Link>
      <h1 className="greet">{heading}</h1>
      <div role="form" aria-label={heading} className="addcard ncform">
        <h2 className="nch">Client</h2>
        {linked && <div className="rqlinkbox on"><p>Linked to {linked.client}’s quote request for {(linked.service || 'another service').toLowerCase()}, sent {dShort(linked.created)}. When you send it, they also see it under that request in their portal.</p><button type="button" className="linkbtn" onClick={() => upd(x => { x.requestId = null })}>Unlink</button></div>}
        {suggest && <div className="rqlinkbox"><p>{suggest.client} asked for a quote on {dShort(suggest.created)}: {suggest.service || 'another service'}. Is this proposal for that request?</p><button type="button" className="btn call" onClick={() => upd(x => { x.requestId = suggest.id })}>Yes, link it</button></div>}
        {fromOpts.length > 0 && (
          <label className="fld"><span>Fill in from a lead or client (optional)</span>
            <select value={pick} onChange={e => fillFrom(e.target.value)}>
              <option value="">Type the details instead</option>
              {fromOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        )}
        <div className="ncgrid">
          <label className="fld span2"><span>Business name <span className="req" aria-hidden="true">*</span><span className="sr">(required)</span></span><input type="text" autoComplete="off" placeholder="e.g. Brightside Accounting" value={pf.biz} onChange={set('biz')} /></label>
          <label className="fld half"><span>Contact name <span className="req" aria-hidden="true">*</span><span className="sr">(required)</span></span><input type="text" autoComplete="off" placeholder="e.g. Megan Clarke" value={pf.contact} onChange={set('contact')} /></label>
          <label className="fld half"><span>Contact email</span><input type="email" autoComplete="off" autoCapitalize="off" placeholder="name@business.com.au" value={pf.email} onChange={set('email')} /></label>
          <label className="fld span2"><span>Site address <span className="req" aria-hidden="true">*</span><span className="sr">(required)</span></span><input type="text" autoComplete="off" placeholder="e.g. 12 Gympie Rd, Kedron QLD 4031" value={pf.address} onChange={set('address')} /></label>
        </div>
        <p className="nchint">Ref {pf.ref} · dated {dLong(pf.created)} · valid for 30 days</p>

        {comm ? <>
          <h2 className="nch">Regular clean</h2>
          <div className="ncgrid">
            <label className="fld half"><span>How often</span>
              <select value={pf.freq} onChange={e => { const v = e.target.value as FreqKey; upd(x => { x.freq = v }) }}>
                {(Object.keys(P_FREQ) as FreqKey[]).map(k => <option key={k} value={k}>{P_FREQ[k].label}</option>)}
              </select>
            </label>
            <label className="fld half"><span>When</span>
              <select value={pf.when} onChange={e => { const v = e.target.value as WhenKey; upd(x => { x.when = v }) }}>
                {WHEN_OPTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
            <label className="fld half"><span>Price per clean ($, incl GST) <span className="req" aria-hidden="true">*</span><span className="sr">(required)</span></span><input type="text" inputMode="decimal" autoComplete="off" placeholder="e.g. 185" value={pf.price} onChange={set('price')} /></label>
          </div>
          {monthly > 0 && <p className="nchint">About {fmt$(Math.round(monthly))} a month incl GST ({fmt$(Math.round(monthly / 1.1))} ex GST), including recurring add-ons. This is only shown to you.</p>}

          <h2 className="nch">Scope of works</h2>
          <p className="nchint">Tick the kind of site. Ticking more than one combines them, and tasks they share only appear once. You can change any line after.</p>
          <div className="presetgrid" role="group" aria-label="Preset scopes">
            {presets.map(ps => (
              <label className="check presetbox" key={ps.id}>
                <input type="checkbox" checked={!!pf.presets[ps.id]} onChange={() => upd(x => { if (x.presets[ps.id]) { delete x.presets[ps.id]; x.sow = removePresetSow(x.sow, ps.id) } else { x.presets[ps.id] = true; x.sow = addPresetSow(x.sow, ps) } })} />
                <span><strong>{ps.name}</strong><span className="psnote">{ps.note}</span></span>
              </label>
            ))}
          </div>
          <label className="upload">
            <input className="sr" type="file" accept="image/*,application/pdf" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; upload(f) }} />
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6M12 18v-6M9 15l3-3 3 3" /></svg>
            <span><strong>{pf.uploadName ? `Replace the uploaded scope (${pf.uploadName})` : 'Upload a bigger scope instead'}</strong><span>For bigger jobs like body corporate. Upload the scope as a screenshot or PDF. It replaces anything ticked above.</span></span>
          </label>
          {reading && <div className="sowstat" role="status"><span>Reading {reading} and turning it into headings and tasks…</span></div>}
          <div className="pscope">
            {pf.sow.map(sowView)}
            {!pf.sow.length && !reading && <p className="nchint">Nothing in the scope yet. Tick a site type, upload a scope, or add a heading.</p>}
            <button type="button" className="btn log" onClick={() => upd(x => { if (x.sow.length < 20) x.sow.push({ heading: '', src: [], items: [{ text: '', orig: '', src: [] }] }) })}>+ Add heading</button>
          </div>

          <h2 className="nch">Add-ons (optional)</h2>
          {pf.addons.map((a, ai) => {
            const nm = addName(a), items = addItems(a)
            const setA = (k: 'freq' | 'custom' | 'desc' | 'price') => (e: { target: { value: string } }) => { const v = e.target.value; upd(x => { x.addons[ai][k] = v }) }
            const own = (fn: (it: { text: string }[]) => void) => upd(x => { const y = x.addons[ai]; y.items = addItems(y).map(z => ({ text: z.text })); fn(y.items) })
            return (
              <div className="extracard" key={ai}>
                <div className="sitehead"><strong>Add-on {ai + 1}{nm ? ': ' + nm : ''}</strong><button type="button" className="linkbtn danger" aria-label={'Remove add-on ' + (ai + 1)} onClick={() => upd(x => { x.addons.splice(ai, 1) })}>Remove</button></div>
                <div className="ncgrid">
                  <label className="fld half"><span>Service</span>
                    <select value={a.kind} onChange={e => {
                      const v = e.target.value
                      upd(x => {
                        const cur = x.addons[ai], prev = (SPEC_METHODS[cur.kind] || []).join('\n'), now = addItems(cur).map(it => tidy(it.text)).filter(Boolean).join('\n')
                        cur.kind = v
                        if (!now || now === prev) cur.items = (SPEC_METHODS[v] || ['']).map(t => ({ text: t }))
                      })
                    }}>
                      <option value="">Choose a service</option>
                      {ADDON_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </label>
                  <label className="fld half"><span>How often</span>
                    <select value={a.freq} onChange={setA('freq')}>
                      <option value="">Choose how often</option>
                      {ADD_FREQ_OPTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                  </label>
                  {a.kind === 'Custom' && <label className="fld span2"><span>Custom service name</span><input type="text" autoComplete="off" placeholder="e.g. High dusting" value={a.custom} onChange={setA('custom')} /></label>}
                  <label className="fld span2"><span>Short description (optional)</span><input type="text" autoComplete="off" placeholder={nm && ADD_ADJ[a.freq] ? ADD_ADJ[a.freq] + ' ' + nm.toLowerCase() + ', charged in addition to the regular clean.' : 'Shown under the add-on price'} value={a.desc} onChange={setA('desc')} /></label>
                  <label className="fld half"><span>Price ($, incl GST)</span><input type="text" inputMode="decimal" autoComplete="off" placeholder="e.g. 120" value={a.price} onChange={setA('price')} /></label>
                </div>
                <div className="addsow">
                  <span className="addsowh">What’s included</span>
                  {!items.length && <p className="nchint">Choose a service to load its standard list, or add your own tasks.</p>}
                  {items.map((it, ii) => (
                    <div className="sowiedit" key={ii}>
                      <input type="text" className="sowin" value={it.text} aria-label="Task" onChange={e => { const v = e.target.value; own(l => { l[ii].text = v }) }} />
                      <button type="button" className="iconbtn" aria-label={'Remove task ' + (it.text || ii + 1) + ' from ' + (nm || 'add-on ' + (ai + 1))} onClick={() => own(l => { l.splice(ii, 1) })}><X /></button>
                    </div>
                  ))}
                  <div className="addsowbtns">
                    <button type="button" className="linkbtn" onClick={() => own(l => { if (l.length < 30) l.push({ text: '' }) })}>+ Add task</button>
                    {!!SPEC_METHODS[a.kind] && <button type="button" className="linkbtn" onClick={() => upd(x => { x.addons[ai].items = (SPEC_METHODS[x.addons[ai].kind] || []).map(t => ({ text: t })) })}>Reset to standard list</button>}
                  </div>
                </div>
              </div>
            )
          })}
          <button type="button" className="btn log addsite" onClick={() => upd(x => { if (x.addons.length < 6) x.addons.push(blankAddon()) })}><Plus />Add an add-on</button>
        </> : <>
          <h2 className="nch">The works</h2>
          {pf.jobs.map((jb, ji) => {
            const nm = jobName(jb)
            const setJ = (k: 'custom' | 'area' | 'included' | 'price') => (e: { target: { value: string } }) => { const v = e.target.value; upd(x => { x.jobs[ji][k] = v }) }
            return (
              <div className="extracard" key={ji}>
                <div className="sitehead"><strong>Service {ji + 1}{nm ? ': ' + nm : ''}</strong>{pf.jobs.length > 1 && <button type="button" className="linkbtn danger" aria-label={'Remove service ' + (ji + 1)} onClick={() => upd(x => { if (x.jobs.length > 1) x.jobs.splice(ji, 1) })}>Remove</button>}</div>
                <div className="ncgrid">
                  <label className="fld half"><span>Service</span>
                    <select value={jb.kind} onChange={e => {
                      const v = e.target.value
                      upd(x => { const cur = x.jobs[ji], prevPreset = (SPEC_METHODS[cur.kind] || []).join('\n'); cur.kind = v; if (!tidy(cur.included) || cur.included === prevPreset) cur.included = (SPEC_METHODS[v] || []).join('\n') })
                    }}>
                      <option value="">Choose a service</option>
                      {JOB_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </label>
                  <label className="fld half"><span>Price ($, incl GST)</span><input type="text" inputMode="decimal" autoComplete="off" placeholder="e.g. 650" value={jb.price} onChange={setJ('price')} /></label>
                  {jb.kind === 'Custom' && <label className="fld span2"><span>Custom service name</span><input type="text" autoComplete="off" placeholder="e.g. Post-construction clean" value={jb.custom} onChange={setJ('custom')} /></label>}
                  <label className="fld span2"><span>Where and how much</span><input type="text" autoComplete="off" placeholder="e.g. Ground floor offices, about 140 m² of carpet" value={jb.area} onChange={setJ('area')} /></label>
                  <label className="fld span2"><span>What&apos;s included (one per line)</span><textarea rows={5} value={jb.included} onChange={setJ('included')} /></label>
                </div>
              </div>
            )
          })}
          <button type="button" className="btn log addsite" onClick={() => upd(x => { if (x.jobs.length < 10) x.jobs.push(blankJob()) })}><Plus />Add another service</button>
          <div className="ncgrid">
            <label className="fld half"><span>Proposed date (optional)</span><input type="date" min={today} value={pf.date2} onChange={set('date2')} /></label>
            <label className="fld half"><span>Timing</span>
              <select value={pf.window} onChange={e => { const v = e.target.value as WinKey; upd(x => { x.window = v }) }}>
                <option value="day">During the day</option>
                <option value="after">After hours</option>
                <option value="weekend">On a weekend</option>
              </select>
            </label>
          </div>
          {total > 0 && <p className="nchint">Total {fmt2(total)} incl GST ({fmt2(total / 1.1)} ex GST).</p>}
        </>}

        <label className="fld"><span>Not included</span><textarea rows={2} value={pf.excl} onChange={set('excl')} /></label>

        {err && <p className="ferr" role="alert">{err}</p>}
        <div className="sheetbtns">
          <button type="button" className="btn call" disabled={busy} onClick={() => save('preview')}>{busy ? 'Saving…' : 'Save and preview'}</button>
          <button type="button" className="btn log" disabled={busy} onClick={() => save('draft')}>Save draft</button>
          <Link className="btn log" href={backHref}>Cancel</Link>
        </div>
      </div>
    </>
  )
}
