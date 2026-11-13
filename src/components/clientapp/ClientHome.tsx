'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { takeFlash } from '@/lib/hub/flash'
import { RQ, pLong, p12, type PortalData } from '@/lib/clientapp/portal'

type Tab = 'cleans' | 'service' | 'docs' | 'invoices' | 'requests'
const TABS: [Tab, string][] = [['cleans', 'Cleans'], ['service', 'My service'], ['docs', 'Documents'], ['invoices', 'Invoices'], ['requests', 'Requests']]
const ST: Record<string, [string, string]> = { new: ['st todo', 'Sent'], replied: ['st going', 'In progress'], done: ['st done', 'Done'] }

export function ClientHome({ first, biz, greeting, starterNag, data, initialTab }: { first: string; biz: string; greeting: string; starterNag: boolean; data: PortalData; initialTab: string }) {
  const [tab, setTab] = useState<Tab>((TABS.some(t => t[0] === initialTab) ? initialTab : 'cleans') as Tab)
  const [open, setOpen] = useState<Record<number, boolean>>({})
  const [toast, setToast] = useState('')
  useEffect(() => { const m = takeFlash(); if (m) setToast(m) }, [])
  useEffect(() => { if (!toast) return; const t = window.setTimeout(() => setToast(''), 5000); return () => window.clearTimeout(t) }, [toast])
  const pick = (t: Tab) => { setTab(t); try { const u = new URL(window.location.href); u.searchParams.set('tab', t); window.history.replaceState(null, '', u) } catch { /* fine */ } }
  const nx = data.upcoming[0]

  return (
    <>
      <h1 className="greet">{greeting}, {first}</h1>
      <p className="sub">{biz}</p>
      {starterNag && <div className="nag"><span>You’re still using your starter password.</span><Link className="linkbtn" href="/client/app/password">Change it</Link></div>}
      <div className="nextcard">
        <span className="nk">Next clean</span>
        <span className="nwhen">{nx ? (nx.day === 'Today' ? 'Today' : nx.day === 'Tmrw' ? 'Tomorrow' : pLong(nx.iso)) + (nx.start ? ', ' + p12(nx.start) : '') : 'Nothing booked'}</span>
        <span className="nwhat">{nx ? nx.site + ' · ' + nx.time : 'Contact us to book your next clean.'}</span>
      </div>
      <div className="seg five" role="tablist" aria-label="Portal sections">
        {TABS.map(([k, l]) => <button key={k} type="button" role="tab" className={tab === k ? 'on' : ''} aria-selected={tab === k} onClick={() => pick(k)}>{l}</button>)}
      </div>

      {tab === 'cleans' && <>
        <h2 className="dayh">Coming up</h2>
        <div className="jobs">
          {data.upcoming.map(u => <div className="row" key={u.key}><span className="jtime">{u.day}<span>{u.date}</span></span><span className="jmain"><span className="jname">{u.site}</span><span className="jsub">{u.time}{u.sub ? ' · ' + u.sub : ''}</span></span><span className="st todo">Booked</span></div>)}
          {!data.upcoming.length && <div className="empty">No cleans booked. Call us to book one.</div>}
        </div>
        <h2 className="dayh">Recent cleans</h2>
        <div className="jobs">
          {data.recent.map(r => <div className="row" key={r.key}><span className="jtime">{r.day}<span>{r.date}</span></span><span className="jmain"><span className="jname">{r.site}</span><span className="jsub">{r.sub}</span></span><span className="st done">Done</span></div>)}
          {!data.recent.length && <div className="empty">Finished cleans show here.</div>}
        </div>
      </>}

      {tab === 'service' && <>
        {data.sites.map((s, si) => (
          <div className="card sitecard" key={s.id + si}>
            <h2 className="h2">{s.name}</h2>
            <p className="hint">{s.address}</p>
            <div className="meta"><span className="chip">{s.days}</span><span className="chip">{s.time}</span><span className="chip">{s.team}</span></div>
            {s.extras && <p className="hint">Also included: {s.extras}</p>}
            {s.sow.length > 0 && <button type="button" className="linkbtn" onClick={() => setOpen(o => ({ ...o, [si]: !o[si] }))} aria-expanded={!!open[si]}>{open[si] ? 'Hide the cleaning checklist' : 'See the cleaning checklist'}</button>}
            {open[si] && s.sow.map((h, hi) => <div className="sowsec" key={hi}><h3 className="sowh">{h.heading}</h3><ul className="plain">{h.items.map((t, ti) => <li key={ti}>{t}</li>)}</ul></div>)}
          </div>
        ))}
        {!data.sites.length && <div className="empty">Your service details will show here once your cleans are set up.</div>}
        <p className="hint">Want something changed? Use the <button type="button" className="linkbtn" onClick={() => pick('requests')}>Requests</button> tab and we’ll come back to you.</p>
      </>}

      {tab === 'docs' && (
        <div className="jobs">
          {data.docs.map(d => <div className="row" key={d.title}><span className="jmain"><span className="jname">{d.title}</span><span className="jsub">{d.sub}</span></span><a className="btn ghost sm" href={d.href} target={d.href.startsWith('/client/app/compliance') ? undefined : '_blank'} rel="noopener" aria-label={'View ' + d.title}>View</a></div>)}
        </div>
      )}

      {tab === 'invoices' && <>
        <p className="hint">Invoices are emailed monthly and are due within 14 days. Payment details are on each invoice.</p>
        <div className="jobs"><div className="empty">Your invoices will show here soon. Until then they come to you by email. For a copy of any invoice, use the Requests tab or call us.</div></div>
      </>}

      {tab === 'requests' && <>
        <p className="hint">Tap what you need. It goes straight to Laith, and you’ll see the reply here and by email.</p>
        <div className="tiles">
          {RQ.map(x => <Link key={x.id} className="tile" href={'/client/app/request/' + x.id}><span className="tt1">{x.label}</span><span className="tt2">{x.sub}</span></Link>)}
        </div>
        <h2 className="dayh">Your requests</h2>
        <div className="jobs">
          {data.requests.map(r => (
            <div className="row rqrow" key={r.id}>
              <span className="jmain"><span className="jname rqtitle">{r.title}</span><span className="jsub wrap2">{r.sub}</span>{r.reply && <span className="reply">{r.reply}</span>}</span>
              <span className={ST[r.status]?.[0] || 'st todo'}>{ST[r.status]?.[1] || 'Sent'}</span>
            </div>
          ))}
          {!data.requests.length && <div className="empty">No requests yet.</div>}
        </div>
      </>}

      <div className="actions">
        {tab !== 'requests' && <button type="button" className="btn main" onClick={() => pick('requests')}>Make a request</button>}
        <a className="btn ghost" href="tel:0407026360">Call Laith, 0407 026 360</a>
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  )
}
