import type { CSSProperties } from 'react'
import type { Swms } from '@/lib/documents/safety'
import { MODERN_SLAVERY } from '@/lib/documents/safety'

const NAVY = '#0F172A'
const SANS = "'Hanken Grotesk', system-ui, sans-serif"
const DISPLAY = "'Schibsted Grotesk', system-ui, sans-serif"
const MONO = "'Space Mono', monospace"
const WORDMARK_BLACK = '/proposal-assets/wordmark-black.png'

const page: CSSProperties = { width: 794, minHeight: 1123, background: '#fff', color: NAVY, padding: '56px 60px', fontFamily: SANS, boxShadow: '0 8px 40px rgba(15,23,42,.10)', margin: '0 auto' }

function Header({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16, borderBottom: '1px solid #E2E8F0', marginBottom: 26 }}>
      <img src={WORDMARK_BLACK} alt="Delta Cleaning" style={{ height: 20, width: 'auto' }} />
      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.14em', color: '#94A3B8', textTransform: 'uppercase' }}>{label}</div>
    </div>
  )
}

function ReviewNote() {
  return (
    <div style={{ marginTop: 24, border: '1px dashed #CBD5E1', borderRadius: 10, padding: '12px 16px', fontSize: 11, lineHeight: 1.55, color: '#94A3B8' }}>
      This Safe Work Method Statement is a template for Delta Cleaning. It should be reviewed and tailored to the actual site,
      chemicals and equipment in use, and read alongside the relevant Safety Data Sheets, before work commences.
    </div>
  )
}

export function SwmsDocument({ swms }: { swms: Swms }) {
  return (
    <div data-doc-root>
      <section data-sheet style={page}>
        <Header label={swms.code} />
        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: 8 }}>Safe Work Method Statement · {swms.code}</div>
        <h1 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 30, lineHeight: 1.05, letterSpacing: '-.02em', margin: '0 0 10px' }}>{swms.title}</h1>
        <p style={{ fontSize: 13, lineHeight: 1.6, color: '#475569', margin: '0 0 22px', maxWidth: 620 }}>{swms.scope}</p>

        <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 2fr 1fr', background: '#0F172A', color: '#fff', fontFamily: MONO, fontSize: 9.5, letterSpacing: '.08em', textTransform: 'uppercase' }}>
            <div style={{ padding: '10px 12px' }}>Hazard</div>
            <div style={{ padding: '10px 12px' }}>Risk</div>
            <div style={{ padding: '10px 12px' }}>Controls</div>
            <div style={{ padding: '10px 12px' }}>PPE</div>
          </div>
          {swms.rows.map((r, i) => (
            <div key={i} style={{ borderTop: '1px solid #EEF2F6' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 2fr 1fr', fontSize: 11.5, lineHeight: 1.45, color: '#334155' }}>
                <div style={{ padding: '12px', fontWeight: 600, color: NAVY }}>{r.hazard}</div>
                <div style={{ padding: '12px', color: '#dc2626' }}>{r.risk}</div>
                <div style={{ padding: '12px' }}>
                  <ul style={{ margin: 0, paddingLeft: 14 }}>{r.controls.map((c, j) => <li key={j} style={{ marginBottom: 3 }}>{c}</li>)}</ul>
                </div>
                <div style={{ padding: '12px' }}>
                  <ul style={{ margin: 0, paddingLeft: 14 }}>{r.ppe.map((p, j) => <li key={j} style={{ marginBottom: 3 }}>{p}</li>)}</ul>
                </div>
              </div>
              <div style={{ padding: '2px 12px 12px', fontSize: 11, color: '#64748B' }}>
                <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase', color: '#94A3B8', marginRight: 6 }}>Emergency</span>
                {r.emergency}
              </div>
            </div>
          ))}
        </div>

        <ReviewNote />

        <div style={{ marginTop: 30, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div>
            <div style={{ borderBottom: '1px solid #CBD5E1', height: 30 }} />
            <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 5 }}>Worker name &amp; signature</div>
          </div>
          <div>
            <div style={{ borderBottom: '1px solid #CBD5E1', height: 30 }} />
            <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 5 }}>Date</div>
          </div>
        </div>
        <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 18 }}>Delta Cleaning Pty Ltd · ABN 83 303 026 478 · Brisbane QLD</p>
      </section>
    </div>
  )
}

export function ModernSlaveryDocument() {
  return (
    <div data-doc-root>
      <section data-sheet style={page}>
        <Header label="Policy" />
        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: 8 }}>Policy Statement</div>
        <h1 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 32, lineHeight: 1.05, letterSpacing: '-.02em', margin: '0 0 22px' }}>{MODERN_SLAVERY.title}</h1>
        {MODERN_SLAVERY.paragraphs.map((p, i) => (
          <p key={i} style={{ fontSize: 14, lineHeight: 1.7, color: '#334155', margin: '0 0 16px' }}>{p}</p>
        ))}
        <div style={{ marginTop: 32, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div>
            <div style={{ borderBottom: '1px solid #CBD5E1', height: 30 }} />
            <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 5 }}>Authorised · Jackson Jaillet, Director</div>
          </div>
          <div>
            <div style={{ borderBottom: '1px solid #CBD5E1', height: 30 }} />
            <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 5 }}>Date</div>
          </div>
        </div>
        <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 26 }}>Delta Cleaning Pty Ltd · ABN 83 303 026 478 · Brisbane QLD</p>
      </section>
    </div>
  )
}
