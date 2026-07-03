import type { CSSProperties } from 'react'
import type { Swms } from '@/lib/documents/safety'
import { MODERN_SLAVERY, SDS_REGISTER, DOC_CONTROL, COMPANY, LEGISLATION, REVIEW_TRIGGERS, EMERGENCY_CONTACTS } from '@/lib/documents/safety'

const NAVY = '#0F172A'
const SANS = "'Hanken Grotesk', system-ui, sans-serif"
const DISPLAY = "'Schibsted Grotesk', system-ui, sans-serif"
const MONO = "'Space Mono', monospace"
const WORDMARK_BLACK = '/proposal-assets/wordmark-black.png'

const page: CSSProperties = { width: 794, minHeight: 1123, background: '#fff', color: NAVY, padding: '52px 60px 44px', fontFamily: SANS, boxShadow: '0 8px 40px rgba(15,23,42,.10)', margin: '0 auto', position: 'relative' }
const eyebrow: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: 8 }
const sectionLabel: CSSProperties = { fontFamily: MONO, fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: 8 }

function Header({ docNo }: { docNo: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16, borderBottom: '1px solid #E2E8F0', marginBottom: 20 }}>
      <img src={WORDMARK_BLACK} alt="Delta Cleaning" style={{ height: 20, width: 'auto' }} />
      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.14em', color: '#94A3B8', textTransform: 'uppercase' }}>{docNo}</div>
    </div>
  )
}

// Document control strip — version / dates / approver
function DocControl({ docNo }: { docNo: string }) {
  const cells: [string, string][] = [
    ['Document', docNo],
    ['Version', DOC_CONTROL.version],
    ['Issue date', DOC_CONTROL.issueDate],
    ['Review date', DOC_CONTROL.reviewDate],
    ['Approved by', DOC_CONTROL.approvedBy],
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden', marginBottom: 22 }}>
      {cells.map(([k, v], i) => (
        <div key={i} style={{ padding: '9px 12px', borderLeft: i ? '1px solid #EEF2F6' : undefined, background: '#F8FAFC' }}>
          <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: '.08em', textTransform: 'uppercase', color: '#94A3B8' }}>{k}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: NAVY, marginTop: 2 }}>{v}</div>
        </div>
      ))}
    </div>
  )
}

function EmergencyBox() {
  return (
    <div style={{ marginTop: 22, border: '1px solid #FECACA', background: '#FEF2F2', borderRadius: 10, padding: '12px 16px' }}>
      <div style={{ ...sectionLabel, color: '#dc2626', marginBottom: 6 }}>Emergency contacts</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 26px' }}>
        {EMERGENCY_CONTACTS.map((c, i) => (
          <span key={i} style={{ fontSize: 12.5, color: '#7f1d1d' }}>
            {c.label}: <strong>{c.value}</strong>
          </span>
        ))}
      </div>
    </div>
  )
}

function ReviewTriggers() {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={sectionLabel}>This SWMS must be reviewed</div>
      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.55, color: '#475569' }}>
        {REVIEW_TRIGGERS.map((t, i) => <li key={i} style={{ marginBottom: 2 }}>{t}</li>)}
      </ul>
    </div>
  )
}

function Legislation() {
  return <p style={{ marginTop: 16, fontSize: 11, lineHeight: 1.55, color: '#94A3B8' }}>{LEGISLATION}</p>
}

function SignOff({ label }: { label: string }) {
  const Line = ({ t }: { t: string }) => (
    <div><div style={{ borderBottom: '1px solid #CBD5E1', height: 28 }} /><div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 5 }}>{t}</div></div>
  )
  return (
    <div style={{ marginTop: 22 }}>
      <div style={sectionLabel}>{label}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 24px', marginTop: 4 }}>
        <Line t="Worker name" />
        <Line t="Company" />
        <Line t="Signature" />
        <Line t="Date" />
      </div>
    </div>
  )
}

function Footer() {
  return (
    <div style={{ marginTop: 26, paddingTop: 14, borderTop: '1px solid #EEF2F6', textAlign: 'center', fontSize: 10.5, color: '#94A3B8', lineHeight: 1.7 }}>
      <div style={{ fontWeight: 600, color: '#64748B' }}>{COMPANY.name} · ABN {COMPANY.abn}</div>
      <div>{COMPANY.location} · {COMPANY.email} · {COMPANY.web}</div>
    </div>
  )
}

export function SwmsDocument({ swms }: { swms: Swms }) {
  return (
    <div data-doc-root>
      <section data-sheet style={page}>
        <Header docNo={swms.code} />
        <DocControl docNo={swms.code} />

        <div style={eyebrow}>Safe Work Method Statement</div>
        <h1 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 30, lineHeight: 1.05, letterSpacing: '-.02em', margin: '0 0 10px' }}>{swms.title}</h1>
        <p style={{ fontSize: 13, lineHeight: 1.6, color: '#475569', margin: '0 0 18px', maxWidth: 620 }}>{swms.scope}</p>

        {swms.chemicals && swms.chemicals.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={sectionLabel}>Products in use</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {swms.chemicals.map((c, i) => (
                <span key={i} style={{ fontSize: 12, border: '1px solid #CBD5E1', borderRadius: 999, padding: '4px 12px', color: '#334155', background: '#fff' }}>{c}</span>
              ))}
            </div>
          </div>
        )}

        <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 2fr 1fr', background: NAVY, color: '#fff', fontFamily: MONO, fontSize: 9.5, letterSpacing: '.08em', textTransform: 'uppercase' }}>
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
                <div style={{ padding: '12px' }}><ul style={{ margin: 0, paddingLeft: 14 }}>{r.controls.map((c, j) => <li key={j} style={{ marginBottom: 3 }}>{c}</li>)}</ul></div>
                <div style={{ padding: '12px' }}><ul style={{ margin: 0, paddingLeft: 14 }}>{r.ppe.map((p, j) => <li key={j} style={{ marginBottom: 3 }}>{p}</li>)}</ul></div>
              </div>
              <div style={{ padding: '2px 12px 12px', fontSize: 11, color: '#64748B' }}>
                <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase', color: '#94A3B8', marginRight: 6 }}>Emergency</span>
                {r.emergency}
              </div>
            </div>
          ))}
        </div>

        <EmergencyBox />
        <ReviewTriggers />
        <Legislation />
        <SignOff label="Received & understood by" />
        <Footer />
      </section>
    </div>
  )
}

export function ModernSlaveryDocument() {
  return (
    <div data-doc-root>
      <section data-sheet style={page}>
        <Header docNo="POLICY" />
        <DocControl docNo="POL-001" />
        <div style={eyebrow}>Policy Statement</div>
        <h1 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 32, lineHeight: 1.05, letterSpacing: '-.02em', margin: '0 0 20px' }}>{MODERN_SLAVERY.title}</h1>
        {MODERN_SLAVERY.paragraphs.map((p, i) => (
          <p key={i} style={{ fontSize: 14, lineHeight: 1.7, color: '#334155', margin: '0 0 16px' }}>{p}</p>
        ))}
        <div style={{ marginTop: 28, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div><div style={{ borderBottom: '1px solid #CBD5E1', height: 30 }} /><div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 5 }}>Authorised · {DOC_CONTROL.approvedBy}</div></div>
          <div><div style={{ borderBottom: '1px solid #CBD5E1', height: 30 }} /><div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 5 }}>Date</div></div>
        </div>
        <Footer />
      </section>
    </div>
  )
}

export function SdsRegisterDocument() {
  return (
    <div data-doc-root>
      <section data-sheet style={page}>
        <Header docNo={SDS_REGISTER.code} />
        <DocControl docNo={SDS_REGISTER.code} />
        <div style={eyebrow}>Register</div>
        <h1 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 30, lineHeight: 1.05, letterSpacing: '-.02em', margin: '0 0 12px' }}>{SDS_REGISTER.title}</h1>
        <p style={{ fontSize: 13, lineHeight: 1.6, color: '#475569', margin: '0 0 20px', maxWidth: 640 }}>{SDS_REGISTER.intro}</p>
        <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.4fr', background: NAVY, color: '#fff', fontFamily: MONO, fontSize: 9.5, letterSpacing: '.08em', textTransform: 'uppercase' }}>
            <div style={{ padding: '10px 14px' }}>Product</div>
            <div style={{ padding: '10px 14px' }}>SDS</div>
            <div style={{ padding: '10px 14px' }}>Location</div>
          </div>
          {SDS_REGISTER.products.map((p, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.4fr', borderTop: '1px solid #EEF2F6', fontSize: 12.5 }}>
              <div style={{ padding: '12px 14px', fontWeight: 600, color: NAVY }}>{p.product}</div>
              <div style={{ padding: '12px 14px', color: '#16a34a' }}>{p.sds}</div>
              <div style={{ padding: '12px 14px', color: '#475569' }}>{p.location}</div>
            </div>
          ))}
        </div>
        <Legislation />
        <Footer />
      </section>
    </div>
  )
}
