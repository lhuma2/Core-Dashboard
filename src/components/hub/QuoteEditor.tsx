'use client'

import { BRAND } from '@/config/brand'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Back } from './icons'
import { saveQuote } from '@/actions/hub-quotes'
import { setFlash } from '@/lib/hub/flash'
import { useDiv } from '@/lib/hub/use-div'
import { hrsText, quoteCalc, resWindowsPrice, RES_CARPET_ROOM } from '@/lib/hub/price-calc'
import {
  EVERY_OPTS, Q_WINF_OPTS, EOL_ADDK, EOL_TERMS, eAddsOn, eTotal, eolAddNote, eolAutoPrice, eolRateNote, eolScope, addTotal, cash2, priceNote, qAddItems, qMoney, residentialScope, residentialTermsGlance, standardAddItems, webRows,
  type EolAdd, type Quote, type QEvery, type WinFreq,
} from '@/lib/hub/home-quotes'

const X = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
const NUMS = (max: number) => Array.from({ length: max + 1 }, (_, i) => String(i))

export function QuoteEditor({ initial, today, from }: { initial: Quote; today: string; from: 'list' | 'view' | 'client' }) {
  const { base, div, name: divName, lower: divLower } = useDiv()
  const router = useRouter()
  const [q, setQState] = useState<Quote>(() => {
    if (initial.calc) return initial
    // First open: a new phone quote follows the calculator; a website or older quote keeps its price until you pick Use.
    const y: Quote = JSON.parse(JSON.stringify(initial))
    y.calc = { auto: !y.id && !qMoney(y.price), pets: /^\s*y/i.test(y.req?.pets || ''), unit: /unit|apartment/i.test(y.req?.propertyType || '') }
    follow(y)
    return y
  })
  const [touched, setTouched] = useState(false)
  const [err, setErr] = useState('')
  const [busy, start] = useTransition()
  const set = (fn: (y: Quote) => void) => { const y: Quote = JSON.parse(JSON.stringify(q)); fn(y); follow(y); setQState(y); setErr(''); setTouched(true) }
  // While the calculator is on, the clean price and hours follow it (and a furnished add-on follows the clean).
  function follow(y: Quote) {
    if (!y.calc?.auto) return
    const c = quoteCalc(y)
    y.price = c ? String(c.price) : ''; y.hours = c ? hrsText(c.hours) : ''; y.priceFromWeb = false
    const f = y.eol?.adds.find(a => a.k === 'furnished' && a.on); if (f) f.price = eolAutoPrice(f, y.price)
  }
  const setCalc = (k: 'auto' | 'pets' | 'unit', v: boolean) => set(y => { y.calc = { auto: !!y.calc?.auto, ...y.calc, [k]: v } })
  const backHref = from === 'view' && q.id ? `${base}/quotes/${q.id}` : from === 'client' && q.forHome ? `${base}/clients/${q.forHome}` : base + '/quotes'

  function own(y: Quote, k: 'windows' | 'carpet') { y[k].items = qAddItems(y, k).map(z => ({ text: z.text })); return y[k].items }
  function act(mode: 'draft' | 'preview' | 'send') {
    start(async () => {
      const r = await saveQuote(q, mode)
      if (!r.ok) { setErr(r.error); return }
      if (mode === 'preview') router.push(`${base}/quotes/${r.id}`)
      else { setFlash(r.toast); router.push(mode === 'send' ? base + '/quotes?show=sent' : base + '/quotes') }
      router.refresh()
    })
  }

  const heading = q.status === 'draft' && q.source === 'website' && !touched ? 'Quote for ' + (q.name || 'a new request') : (q.ref ? 'Edit ' + q.ref : 'New quote')
  const rows = webRows(q)
  const calc = quoteCalc(q)
  const price = qMoney(q.price)
  const pNote = priceNote(q)
  const total = addTotal(q)
  const eol = q.type === 'eol'
  const only = eol && !!q.eol?.only
  const shown = only ? eTotal(q) : price
  // Full end of lease clean, or add-ons on their own (e.g. carpet steam cleaning only): no clean, scope or clean price.
  const setOnly = (v: boolean) => { if (v !== only) set(y => {
    if (!y.eol) return
    y.eol.only = v
    if (v) {
      y.scope = []; y.price = ''; y.priceFromWeb = false; y.hours = ''
      const f = y.eol.adds.find(a => a.k === 'furnished'); if (f) f.on = false
      if (!eAddsOn(y).length) { const c = y.eol.adds.find(a => a.k === 'carpet'); if (c) { c.on = true; if (!qMoney(c.price)) c.price = eolAutoPrice(c, '') } }
      if (y.heading === 'Your end of lease clean quote' && y.eol.adds.some(a => a.on && a.k === 'carpet')) y.heading = 'Your carpet steam cleaning quote'
    } else {
      y.scope = eolScope(y.eol.garage, y.eol.balcony)
      if (y.heading === 'Your carpet steam cleaning quote') y.heading = 'Your end of lease clean quote'
    }
  }) }
  const terms = eol ? EOL_TERMS : residentialTermsGlance(q.type, q.every)
  const stdScope = (y: Quote) => (y.type === 'eol' ? eolScope(y.eol?.garage, y.eol?.balcony) : residentialScope(y.type))
  const setAdd = (ai: number, fn: (a: EolAdd, y: Quote) => void) => set(y => { if (y.eol) fn(y.eol.adds[ai], y) })
  const winNote = q.windows.fromWeb ? 'Picked on the website at ' + cash2(qMoney(q.windows.webPrice)) + '. Shows on the quote.' : (q.windows.on ? 'Added by you. Shows on the quote.' : 'Not picked, so it is not on the quote. Tick it only if they asked another way.')
  const carNote = q.carpet.fromWeb ? 'Picked on the website at ' + cash2(qMoney(q.carpet.webPrice)) + '. Shows on the quote.' : (q.carpet.on ? 'Added by you. Shows on the quote.' : 'Not picked, so it is not on the quote. Tick it only if they asked another way.')

  // A plain function (not a component), so typing in a task keeps its focus.
  const addList = (k: 'windows' | 'carpet', label: string) => {
    const items = qAddItems(q, k)
    return (
      <div className="addsow">
        <span className="addsowh">What’s included</span>
        {!items.length && <p className="nchint">Nothing listed. Add a task or reset to the standard list.</p>}
        {items.map((it, ii) => (
          <div className="sowiedit" key={ii}>
            <input type="text" className="sowin" value={it.text} aria-label="Task" onChange={e => { const v = e.target.value; set(y => { own(y, k)[ii].text = v }) }} />
            <button type="button" className="iconbtn" aria-label={`Remove ${it.text || 'task ' + (ii + 1)} from ${label}`} onClick={() => set(y => { own(y, k).splice(ii, 1) })}><X /></button>
          </div>
        ))}
        <div className="addsowbtns">
          <button type="button" className="linkbtn" onClick={() => set(y => { const l = own(y, k); if (l.length < 30) l.push({ text: '' }) })}>+ Add task</button>
          <button type="button" className="linkbtn" onClick={() => set(y => { y[k].items = standardAddItems(k) })}>Reset to standard list</button>
        </div>
      </div>
    )
  }

  return (
    <>
      <Link className="back" href={backHref}><Back /> {from === 'client' && q.forHome ? initial.name || 'Client' : 'Quotes'}</Link>
      <h1 className="greet">{heading}</h1>
      {q.ref && <p className="sub"><span>Ref {q.ref}</span></p>}
      {q.forHome && <p className="fhint">Started from {initial.name || 'this client'}’s page and listed there. If they accept, it goes onto their client card, unless that card still has cleans booked that this would replace. Then it gets its own card so those stay the same.</p>}
      {rows.length > 0 && (
        <details className="addcard webreq" open>
          <summary className="nch">What they asked for on the website</summary>
          <dl className="cpkv">{rows.map(r => <div key={r.k}><dt>{r.k}</dt><dd>{r.v}</dd></div>)}</dl>
        </details>
      )}
      <div role="form" aria-label="Quote" className="addcard ncform">
        <h2 className="nch"><span className="qstep">1</span> Heading</h2>
        <div className="ncgrid">
          <label className="fld span2"><span>Quote title</span><input type="text" autoComplete="off" value={q.heading} onChange={e => { const v = e.target.value; set(y => { y.heading = v }) }} /></label>
          <label className="fld span2"><span>Opening line</span><textarea rows={2} value={q.intro} onChange={e => { const v = e.target.value; set(y => { y.intro = v }) }} /></label>
          <label className="fld half"><span>Client name <span className="req" aria-hidden="true">*</span><span className="sr">(required)</span></span><input type="text" autoComplete="off" value={q.name} onChange={e => { const v = e.target.value; set(y => { y.name = v }) }} /></label>
          <label className="fld half"><span>Email</span><input type="email" autoComplete="off" autoCapitalize="off" value={q.email} onChange={e => { const v = e.target.value; set(y => { y.email = v }) }} /></label>
          <label className="fld half"><span>Phone</span><input type="tel" autoComplete="off" value={q.phone} onChange={e => { const v = e.target.value; set(y => { y.phone = v }) }} /></label>
          <label className="fld half"><span>Area</span><input type="text" autoComplete="off" placeholder="e.g. Redlands" value={q.region} onChange={e => { const v = e.target.value; set(y => { y.region = v }) }} /></label>
          <label className="fld span2"><span>Street address (optional, they confirm it when they accept)</span><input type="text" autoComplete="off" value={q.street} onChange={e => { const v = e.target.value; set(y => { y.street = v }) }} /></label>
          <label className="fld subf"><span>Suburb</span><input type="text" autoComplete="off" value={q.suburb} onChange={e => { const v = e.target.value; set(y => { y.suburb = v }) }} /></label>
          <label className="fld pc"><span>Postcode</span><input type="text" inputMode="numeric" maxLength={4} autoComplete="off" value={q.postcode} onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 4); set(y => { y.postcode = v }) }} /></label>
          <label className="fld q"><span>Bedrooms</span><select value={String(q.beds)} onChange={e => { const v = +e.target.value; set(y => { y.beds = v }) }}>{NUMS(7).map(n => <option key={n} value={n}>{n}</option>)}</select></label>
          <label className="fld q"><span>Bathrooms</span><select value={String(q.baths)} onChange={e => { const v = +e.target.value; set(y => { y.baths = v }) }}>{NUMS(7).map(n => <option key={n} value={n}>{n}</option>)}</select></label>
          <label className="fld q"><span>Living areas</span><select value={String(q.living)} onChange={e => { const v = +e.target.value; set(y => { y.living = v }) }}>{NUMS(7).map(n => <option key={n} value={n}>{n}</option>)}</select></label>
          {eol && q.eol && <>
            <label className="fld q"><span>Kitchens</span><select value={String(q.eol.kitchens)} onChange={e => { const v = +e.target.value; set(y => { if (y.eol) y.eol.kitchens = v }) }}>{NUMS(4).map(n => <option key={n} value={n}>{n}</option>)}</select></label>
            <label className="fld q"><span>Garage</span><select value={String(q.eol.garage)} onChange={e => { const v = +e.target.value; set(y => { if (y.eol) y.eol.garage = v }) }}>{NUMS(3).map(n => <option key={n} value={n}>{n}</option>)}</select></label>
            <label className="fld q"><span>Balcony</span><select value={String(q.eol.balcony)} onChange={e => { const v = +e.target.value; set(y => { if (y.eol) y.eol.balcony = v }) }}>{NUMS(3).map(n => <option key={n} value={n}>{n}</option>)}</select></label>
          </>}
          <label className="fld span2"><span>Notes for the cleaner (not shown on the quote)</span><input type="text" autoComplete="off" value={q.notes} onChange={e => { const v = e.target.value; set(y => { y.notes = v }) }} /></label>
        </div>

        <h2 className="nch"><span className="qstep">2</span> Scope of works</h2>
        {eol ? <div className="stypes" role="radiogroup" aria-label="What they want">
          <button type="button" role="radio" className={only ? 'stype' : 'stype on'} aria-checked={!only} onClick={() => setOnly(false)}>
            <span className="sttext"><strong>End of Lease clean</strong><span>Your standard end of lease scope, plus Garage and Balcony boxes when the form has them</span></span>
          </button>
          <button type="button" role="radio" className={only ? 'stype on' : 'stype'} aria-checked={only} onClick={() => setOnly(true)}>
            <span className="sttext"><strong>Add-ons only</strong><span>No clean. Just carpet steam cleaning, blinds or other add-ons</span></span>
          </button>
        </div>
        : <div className="stypes" role="radiogroup" aria-label="Type of clean">
          <button type="button" role="radio" className={q.type === 'deep' ? 'stype on' : 'stype'} aria-checked={q.type === 'deep'}
            onClick={() => { if (q.type !== 'deep') set(y => { y.type = 'deep'; y.scope = residentialScope('deep'); if (y.every !== 'oneoff') y.every = 'oneoff' }) }}>
            <span className="sttext"><strong>Deep-Clean</strong><span>One-off, top to bottom</span></span>
          </button>
          <button type="button" role="radio" className={q.type === 'general' ? 'stype on' : 'stype'} aria-checked={q.type === 'general'}
            onClick={() => { if (q.type !== 'general') set(y => { y.type = 'general'; y.scope = residentialScope('general'); if (y.every === 'oneoff') y.every = 'fortnightly'; y.carpet.on = false }) }}>
            <span className="sttext"><strong>General Maintenance</strong><span>Standard clean, regular or one-off</span></span>
          </button>
        </div>}
        {only ? <p className="nchint">No end of lease clean on this quote. Tick what they want under Price (step 4). Each add-on’s list of what’s included is its scope on the quote.</p> : <>
        <p className="nchint">Your standard boxes are pulled in for the type you pick. Change, add or remove anything for this quote.</p>
        <div className="pscope">
          {q.scope.map((g, gi) => (
            <div className="sowsec" key={gi}>
              <div className="sowhedit">
                <span className="pin">{('0' + (gi + 1)).slice(-2)}</span>
                <label className="fld grow"><span className="sr">Box heading</span><input type="text" value={g.heading} aria-label="Box heading" onChange={e => { const v = e.target.value; set(y => { y.scope[gi].heading = v }) }} /></label>
                <button type="button" className="linkbtn danger" aria-label={`Remove box ${g.heading || gi + 1}`} onClick={() => set(y => { y.scope.splice(gi, 1) })}>Remove box</button>
              </div>
              {g.items.map((it, ii) => (
                <div className="sowiedit" key={ii}>
                  <input type="text" className="sowin" value={it.text} aria-label="Task" onChange={e => { const v = e.target.value; set(y => { y.scope[gi].items[ii].text = v }) }} />
                  <button type="button" className="iconbtn" aria-label={`Remove task ${it.text || ii + 1}`} onClick={() => set(y => { y.scope[gi].items.splice(ii, 1) })}><X /></button>
                </div>
              ))}
              <button type="button" className="linkbtn" onClick={() => set(y => { y.scope[gi].items.push({ text: '' }) })}>+ Add task</button>
            </div>
          ))}
          {!q.scope.length && <p className="nchint">No boxes yet.</p>}
          <div className="sheetbtns">
            <button type="button" className="btn log" onClick={() => set(y => { y.scope.push({ heading: 'New area', items: [{ text: '' }] }) })}>+ Add box</button>
            <button type="button" className="btn log" onClick={() => set(y => { y.scope = stdScope(y) })}>Reset to my standard scope</button>
          </div>
        </div>
        </>}

        <h2 className="nch"><span className="qstep">3</span> Terms</h2>
        <p className="nchint">Your standard quote terms go in automatically, matched to a one-off or regular clean. They show on the quote in this order.</p>
        <ol className="qterms">{terms.map((t, i) => <li key={i}>{t}</li>)}</ol>

        <h2 className="nch"><span className="qstep">4</span> Price</h2>
        {!only && <div className="calcbox" role="group" aria-label="Price calculator">
          <div className="calchead"><strong>Price calculator</strong><span>Same rates as the website</span></div>
          <div className="calcopts">
            {eol
              ? <label className="check"><input type="checkbox" checked={!!q.calc?.unit} onChange={e => setCalc('unit', e.target.checked)} /><span>Unit or apartment</span></label>
              : <label className="check"><input type="checkbox" checked={!!q.calc?.pets} onChange={e => setCalc('pets', e.target.checked)} /><span>Pets in the home</span></label>}
          </div>
          {calc
            ? <p className="calcres"><strong>{cash2(calc.price)}</strong> incl GST{eol ? '' : ' per clean'} · {hrsText(calc.hours)} hrs{calc.charged > calc.hours ? ' (charged ' + hrsText(calc.charged) + ')' : ''}</p>
            : <p className="calcres">Pick the rooms in step 1 to see a price.</p>}
          {calc && <p className="calcwhy">{calc.lines.join(' · ')} · {cash2(calc.rateEx)}/hr ex GST</p>}
          {calc && (q.calc?.auto
            ? <p className="calcwhy">The price and hours below follow the calculator. Type your own price to override it.</p>
            : <button type="button" className="btn log calcuse" onClick={() => setCalc('auto', true)}>Use {cash2(calc.price)}</button>)}
        </div>}
        <div className="ncgrid">
          {eol ? <div className="fld half"><span>How often</span><div className="freqread">{only ? 'One-off, add-ons only' : 'One-off end of lease clean'}</div></div>
            : q.type === 'general'
            ? <label className="fld half"><span>How often</span><select value={q.every} onChange={e => { const v = e.target.value as QEvery; set(y => { y.every = v }) }}>{EVERY_OPTS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}</select></label>
            : <div className="fld half"><span>How often</span><div className="freqread">One-off deep clean</div></div>}
          <label className="fld half"><span>{eol ? 'Move-out / clean date (optional)' : 'Preferred date (optional)'}</span><input type="date" min={today} value={q.start} onChange={e => { const v = e.target.value; set(y => { y.start = v }) }} /></label>
          {!only && <label className="fld half"><span>{eol ? 'Price for the clean ($, incl GST)' : 'Price per clean ($, incl GST)'} <span className="req" aria-hidden="true">*</span><span className="sr">(required)</span></span><input type="text" inputMode="decimal" autoComplete="off" value={q.price} onChange={e => { const v = e.target.value; set(y => { y.price = v; y.priceFromWeb = false; if (y.calc) y.calc.auto = false }) }} /></label>}
          <label className="fld half"><span>Estimated hours (optional)</span><input type="text" inputMode="decimal" autoComplete="off" value={q.hours} onChange={e => { const v = e.target.value.replace(/[^0-9.]/g, ''); set(y => { y.hours = v; if (y.calc) y.calc.auto = false }) }} /></label>
        </div>
        {pNote && <p className="fhint">{pNote}</p>}
        {!only && price > 0 && <p className="money">Ex GST {cash2(price / 1.1)} · GST {cash2(price - price / 1.1)}</p>}
        {eol && <>
          <p className="nchint">{only ? 'Tick what they want. Each one shows on the quote with its own list of what’s included, and its price.' : 'Add-ons from the website form. Ticked ones show on the quote with their own list of what’s included.'}</p>
          {(q.eol?.adds || []).map((a, ai) => {
            const d = EOL_ADDK[a.k]
            if (only && d.pct) return null
            return (
              <div className="extracard" key={a.k} data-testid={'eoladd-' + a.k}>
                <label className="check"><input type="checkbox" checked={a.on} onChange={e => { const v = e.target.checked; setAdd(ai, (x, y) => { x.on = v; if (v && !qMoney(x.price)) x.price = eolAutoPrice(x, y.price) }) }} /><span><strong>{d.label}</strong> add-on</span></label>
                <p className="fhint">{eolAddNote(a)}</p>
                {a.on && <>
                  <div className="ncgrid">
                    {d.unit && <label className="fld q"><span>How many {d.unit}s</span><select value={a.qty || '1'} onChange={e => { const v = e.target.value; setAdd(ai, (x, y) => { x.qty = v; x.price = eolAutoPrice(x, y.price) }) }}>{Array.from({ length: d.max || 1 }, (_, i) => String(i + 1)).map(n => <option key={n} value={n}>{n}</option>)}</select></label>}
                    <label className="fld half"><span>Price ($, incl GST)</span><input type="text" inputMode="decimal" autoComplete="off" value={a.price} onChange={e => { const v = e.target.value; setAdd(ai, x => { x.price = v }) }} /></label>
                  </div>
                  <p className="fhint">{eolRateNote(a)}</p>
                  <div className="addsow">
                    <span className="addsowh">What’s included</span>
                    {!a.items.length && <p className="nchint">Nothing listed. Add a task or reset to the standard list.</p>}
                    {a.items.map((it, ii) => (
                      <div className="sowiedit" key={ii}>
                        <input type="text" className="sowin" value={it.text} aria-label="Task" onChange={e => { const v = e.target.value; setAdd(ai, x => { x.items[ii].text = v }) }} />
                        <button type="button" className="iconbtn" aria-label={`Remove ${it.text || 'task ' + (ii + 1)} from ${d.label.toLowerCase()}`} onClick={() => setAdd(ai, x => { x.items.splice(ii, 1) })}><X /></button>
                      </div>
                    ))}
                    <div className="addsowbtns">
                      <button type="button" className="linkbtn" onClick={() => setAdd(ai, x => { if (x.items.length < 30) x.items.push({ text: '' }) })}>+ Add task</button>
                      <button type="button" className="linkbtn" onClick={() => setAdd(ai, x => { x.items = d.items.map(text => ({ text })) })}>Reset to standard list</button>
                    </div>
                  </div>
                </>}
              </div>
            )
          })}
        </>}
        {!eol && <div className="extracard">
          <label className="check"><input type="checkbox" checked={q.windows.on} onChange={e => { const v = e.target.checked; set(y => { y.windows.on = v; if (v && !qMoney(y.windows.price)) y.windows.price = String(resWindowsPrice(y.beds)) }) }} /><span><strong>Internal windows</strong> add-on</span></label>
          <p className="fhint">{winNote}</p>
          {q.windows.on && <>
            <div className="ncgrid">
              <label className="fld half"><span>Price ($, incl GST)</span><input type="text" inputMode="decimal" autoComplete="off" value={q.windows.price} onChange={e => { const v = e.target.value; set(y => { y.windows.price = v }) }} /></label>
              {q.every !== 'oneoff' && <label className="fld half"><span>How often windows are charged</span><select value={q.windows.freq || 'monthly'} onChange={e => { const v = e.target.value as WinFreq; set(y => { y.windows.freq = v }) }}>{Q_WINF_OPTS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}</select></label>}
            </div>
            {addList('windows', 'windows')}
          </>}
        </div>}
        {q.type === 'deep' && (
          <div className="extracard">
            <label className="check"><input type="checkbox" checked={q.carpet.on} onChange={e => { const v = e.target.checked; set(y => { y.carpet.on = v; if (v && !qMoney(y.carpet.price) && +y.carpet.rooms > 0) y.carpet.price = String(+y.carpet.rooms * RES_CARPET_ROOM) }) }} /><span><strong>Carpet Steam Cleaning</strong> add-on</span></label>
            <p className="fhint">{carNote}</p>
            {q.carpet.on && <>
              <div className="ncgrid">
                <label className="fld q"><span>Rooms</span><select value={q.carpet.rooms} onChange={e => { const v = e.target.value; set(y => { y.carpet.rooms = v; if (+v > 0) y.carpet.price = String(+v * RES_CARPET_ROOM) }) }}>{NUMS(8).map(n => <option key={n} value={n}>{n}</option>)}</select></label>
                <label className="fld q"><span>Hallways</span><select value={q.carpet.halls} onChange={e => { const v = e.target.value; set(y => { y.carpet.halls = v }) }}>{NUMS(8).map(n => <option key={n} value={n}>{n}</option>)}</select></label>
                <label className="fld half"><span>Price ($, incl GST)</span><input type="text" inputMode="decimal" autoComplete="off" value={q.carpet.price} onChange={e => { const v = e.target.value; set(y => { y.carpet.price = v }) }} /></label>
              </div>
              {addList('carpet', 'carpet steam cleaning')}
            </>}
          </div>
        )}
        {q.type === 'general' && <p className="fhint">Standard cleans only offer the windows add-on.</p>}
        {total && <p className="money">{total}</p>}
        {only && shown > 0 && <p className="money">Ex GST {cash2(shown / 1.1)} · GST {cash2(shown - shown / 1.1)}</p>}

        <h2 className="nch"><span className="qstep">5</span> Contact</h2>
        <p className="nchint">Your details close the quote: Laith Humadi, {BRAND.email}, 0407 026 360, www.{BRAND.website}.</p>

        {err && <p className="ferr" role="alert">{err}</p>}
        <div className="cpbtns">
          <button type="button" className="btn call" disabled={busy} onClick={() => act('send')}>{q.status === 'sent' || q.status === 'changes' ? 'Send revised quote' : 'Send to client'}</button>
          <button type="button" className="btn log" disabled={busy} onClick={() => act('preview')}>Save and preview</button>
          <button type="button" className="btn log" disabled={busy} onClick={() => act('draft')}>Save draft</button>
          <Link className="btn log" href={backHref}>Cancel</Link>
        </div>
      </div>
    </>
  )
}
