'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createDocumentAction } from '@/actions/documents'
import { calculateBillingBreakdown } from '@/lib/billing'
import { formatAUD } from '@/lib/formatters'
import { SERVICE_TYPE_LABELS } from '@/lib/constants'
import type { Client, DocumentType, FrequencyType, ServiceType, DocumentContent } from '@/types/app'

/* ─── Design tokens ─────────────────────────────────────────────────────────── */
const INK       = '#111111'
const INK_MID   = '#444440'
const INK_SOFT  = '#777772'
const INK_FAINT = '#AAAAAA'
const RULE      = '#E4E4E0'
const RULE_LIGHT = '#F0F0EC'
const BG        = '#EEECEA'
const SURFACE   = '#FFFFFF'
const SURFACE_OFF = '#F8F7F5'

/* ─── Proposal data ─────────────────────────────────────────────────────────── */
const SCOPE_AREAS = [
  { key: 'general',   label: 'General Offices & Workspaces', summary: 'Desks, floors, bins, glass',          tags: ['Surface wipe-down', 'Vacuuming', 'Mopping', 'Bin liners', 'Internal glass', 'High-touch sanitising'] },
  { key: 'bathrooms', label: 'Bathrooms & Amenities',        summary: 'Toilets, basins, floors',             tags: ['Toilet & urinal sanitising', 'Basin & tap polish', 'Mirror clean', 'Consumable restock', 'Floor mop', 'Bin reline'] },
  { key: 'kitchen',   label: 'Kitchen & Break Room',         summary: 'Benches, appliances, floor',          tags: ['Bench wipe-down', 'Appliance exteriors', 'Sink clean', 'Floor mop', 'Bin reline'] },
  { key: 'reception', label: 'Reception & Lobby',            summary: 'Entry, waiting area',                 tags: ['Reception desk', 'Entry glass', 'Seating area', 'Floor sweep & mop'] },
  { key: 'warehouse', label: 'Warehouse / Workshop',         summary: 'Floor sweep, common areas',           tags: ['Floor sweep', 'Workbench wipe-down', 'Common areas', 'Waste removal'] },
]

const ADDITIONAL_SERVICES = [
  { key: 'pressure', label: 'Pressure Washing',    desc: 'External surfaces, car parks, pathways, building exteriors', price: 'POA' },
  { key: 'carpet',   label: 'Carpet Extraction',   desc: 'Hot water extraction deep clean of all carpeted areas',       price: 'POA' },
  { key: 'vinyl',    label: 'Deep Vinyl Cleaning',  desc: 'Machine scrub, strip, and reseal of vinyl flooring',          price: 'POA' },
  { key: 'windows',  label: 'Window Washing',       desc: 'Full internal and external window clean including frames',    price: 'POA' },
]

const CLEANS_OPTIONS = [1, 2, 3, 5]

const FREQUENCY_OPTIONS: { value: FrequencyType; label: string; sub: string }[] = [
  { value: 'daily',       label: '365',  sub: 'Daily' },
  { value: 'weekly',      label: '52',   sub: 'Weekly' },
  { value: 'fortnightly', label: '26',   sub: 'Fortnightly' },
  { value: 'monthly',     label: '12',   sub: 'Monthly' },
  { value: 'quarterly',   label: '4',    sub: 'Quarterly' },
  { value: 'annual',      label: '1',    sub: 'Annual' },
  { value: 'one_off',     label: '1×',   sub: 'One-off' },
]
const CONTRACT_LENGTHS  = ['3 months', '6 months', '12 months', '24 months', 'Month-to-month']
const NOTICE_PERIODS    = ['2 weeks', '4 weeks', '30 days', '60 days', '90 days']
const PAYMENT_TERMS_OPTS = ['7 days', '14 days', '30 days', 'End of month']

/* ─── Helpers ───────────────────────────────────────────────────────────────── */
function generateRef() { return `DC-${Math.floor(100000 + Math.random() * 900000)}` }
function todayISO()    { return new Date().toISOString().split('T')[0] }

const inp: React.CSSProperties = {
  width: '100%', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 13,
  color: INK, background: SURFACE, border: `1px solid ${RULE}`,
  borderRadius: 3, padding: '10px 12px', outline: 'none', boxSizing: 'border-box',
}

/* ─── Shared layout shell ───────────────────────────────────────────────────── */
interface ShellProps {
  docLabel: string
  docSub?: string
  steps: string[]
  step: number
  onBack: () => void
  clientName?: string
  children: React.ReactNode
}

function BuilderShell({ docLabel, docSub, steps, step, onBack, clientName, children }: ShellProps) {
  const pct = steps.length > 1 ? ((step / (steps.length - 1)) * 100) : 100

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: 'calc(100vh - 3.5rem)' }}>
      {/* ── Sidebar ── */}
      <div style={{ background: INK, padding: '28px 20px 24px', display: 'flex', flexDirection: 'column', position: 'sticky', top: '3.5rem', height: 'calc(100vh - 3.5rem)', overflowY: 'auto' }}>
        {/* Logo */}
        <div style={{ marginBottom: 8 }}>
          <Image src="/logo-white.png" alt="Core Cleaning" width={90} height={28} style={{ objectFit: 'contain', objectPosition: 'left center' }} />
        </div>

        {/* Back */}
        <button onClick={onBack}
          style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'inherit', fontSize: 10, color: 'rgba(255,255,255,0.28)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 24, letterSpacing: '0.04em', transition: 'color 0.15s', textAlign: 'left' }}
          onMouseEnter={e => ((e.target as HTMLElement).style.color = 'rgba(255,255,255,0.6)')}
          onMouseLeave={e => ((e.target as HTMLElement).style.color = 'rgba(255,255,255,0.28)')}
        >
          ← Documents
        </button>

        {/* Doc type */}
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'white', marginBottom: 2 }}>{docLabel}</p>
        {clientName && <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 300, marginBottom: 20, letterSpacing: '0.02em' }}>{clientName}</p>}
        {!clientName && <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontWeight: 300, marginBottom: 20 }}>{docSub || 'Select client to start'}</p>}

        {/* Step list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
          {steps.map((s, i) => {
            const isDone   = i < step
            const isActive = i === step
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 9px', borderRadius: 3, background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent' }}>
                {/* Dot */}
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 8, fontWeight: 700, letterSpacing: 0,
                  border: isDone ? 'none' : `1px solid ${isActive ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.14)'}`,
                  background: isDone ? 'white' : 'transparent',
                  color: isDone ? INK : isActive ? 'white' : 'rgba(255,255,255,0.22)',
                  transition: 'all 0.2s',
                }}>
                  {isDone ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: 10.5, color: isActive ? 'rgba(255,255,255,0.78)' : isDone ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.22)', fontWeight: isActive ? 500 : 400, transition: 'color 0.12s' }}>{s}</span>
              </div>
            )
          })}
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: 9, color: 'rgba(255,255,255,0.14)', lineHeight: 1.9 }}>
          Core Cleaning<br />Document Builder
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ background: BG, overflowY: 'auto' }}>
        {/* Progress bar */}
        <div style={{ height: 2, background: RULE }}>
          <div style={{ height: '100%', background: INK, borderRadius: 1, transition: 'width 0.4s cubic-bezier(0.4,0,0.2,1)', width: `${pct}%` }} />
        </div>

        <div style={{ maxWidth: 620, padding: '44px 52px 80px', margin: '0 auto' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

/* ─── Shared UI atoms ───────────────────────────────────────────────────────── */
function PanelEyebrow({ n, total }: { n: number; total: number }) {
  return <p style={{ fontSize: 9, letterSpacing: '0.26em', textTransform: 'uppercase', color: INK_FAINT, fontWeight: 600, marginBottom: 8 }}>Step {n} of {total}</p>
}
function PanelHeading({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 26, fontWeight: 400, color: INK, marginBottom: 6, lineHeight: 1.2, letterSpacing: '-0.02em' }}>{children}</h2>
}
function PanelSub({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 12.5, color: INK_SOFT, fontWeight: 300, lineHeight: 1.65, marginBottom: 28, maxWidth: 380 }}>{children}</p>
}
function FieldLabel({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <label style={{ display: 'block', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: INK, marginBottom: 5 }}>
      {children}
      {optional && <span style={{ fontWeight: 300, textTransform: 'none', letterSpacing: 0, fontSize: 9.5, color: INK_FAINT, marginLeft: 4 }}>optional</span>}
    </label>
  )
}
function Divider() {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0' }}>
    <div style={{ flex: 1, height: 1, background: RULE }} />
    <span style={{ fontSize: 9, color: INK_FAINT, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 600 }}>or enter manually</span>
    <div style={{ flex: 1, height: 1, background: RULE }} />
  </div>
}
function PanelNav({ onBack, onNext, nextLabel = 'CONTINUE', disabled }: { onBack?: () => void; onNext?: () => void; nextLabel?: string; disabled?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 32, paddingTop: 20, borderTop: `1px solid ${RULE_LIGHT}` }}>
      {onNext && (
        <button onClick={onNext} disabled={disabled}
          style={{ fontFamily: 'inherit', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', background: disabled ? '#999' : INK, color: 'white', border: 'none', padding: '11px 26px', borderRadius: 3, cursor: disabled ? 'not-allowed' : 'pointer', transition: 'opacity 0.15s' }}>
          {nextLabel}
        </button>
      )}
      {onBack && (
        <button onClick={onBack}
          style={{ fontFamily: 'inherit', fontSize: 10.5, fontWeight: 500, color: INK_SOFT, background: 'none', border: 'none', padding: '11px 0', cursor: 'pointer' }}>
          Back
        </button>
      )}
    </div>
  )
}
function CheckBox({ checked }: { checked: boolean }) {
  return (
    <div style={{ width: 18, height: 18, borderRadius: 3, border: `1.5px solid ${checked ? INK : RULE}`, background: checked ? INK : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.12s' }}>
      {checked && <svg width="9" height="9" viewBox="0 0 9 9"><polyline points="1.5,4.5 3.5,6.5 7.5,2.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>}
    </div>
  )
}

/* ─── Main export ───────────────────────────────────────────────────────────── */
interface DocumentBuilderProps {
  clients: Client[]
  preselectedClientId?: string
  preselectedType?: DocumentType
}

export function DocumentBuilder({ clients, preselectedClientId, preselectedType }: DocumentBuilderProps) {
  const router = useRouter()
  const [docType, setDocType] = useState<DocumentType | null>(preselectedType ?? null)

  // Back always goes to /documents — no middle screen when coming from dropdown
  const handleBack = () => router.push('/documents')

  if (!docType) return <HomeScreen onSelect={setDocType} />
  if (docType === 'proposal') return <ProposalBuilder clients={clients} preselectedClientId={preselectedClientId} onBack={handleBack} />
  return <AgreementBuilder docType={docType} clients={clients} preselectedClientId={preselectedClientId} onBack={handleBack} />
}

/* ─── Home screen (when navigating to /documents/new without a type) ────────── */
function HomeScreen({ onSelect }: { onSelect: (t: DocumentType) => void }) {
  const router = useRouter()
  const cards = [
    { type: 'proposal' as DocumentType,             tag: 'Pre-sale',   title: 'Proposal',             desc: 'Present your services with a professional quote including scope, pricing, and inclusions.' },
    { type: 'cleaning_agreement' as DocumentType,   tag: 'Ongoing',    title: 'Cleaning Agreement',   desc: 'A formal service agreement covering schedule, pricing, and terms — ready for signature.' },
    { type: 'specialist_agreement' as DocumentType, tag: 'Specialist', title: 'Specialist Agreement', desc: 'For one-off or periodic specialist services: pressure washing, window cleaning, or floor care.' },
  ]
  return (
    <div style={{ minHeight: 'calc(100vh - 3.5rem)', background: INK, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
      <div style={{ position: 'absolute', top: 80, left: 32 }}>
        <button onClick={() => router.push('/documents')} style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>← Documents</button>
      </div>
      <Image src="/logo-white.png" alt="Core Cleaning" width={100} height={32} style={{ objectFit: 'contain', marginBottom: 52 }} />
      <p style={{ fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', fontWeight: 600, textAlign: 'center', marginBottom: 12 }}>Document Builder</p>
      <h1 style={{ fontFamily: 'Inter', fontSize: 26, fontWeight: 400, color: 'white', textAlign: 'center', marginBottom: 40 }}>What would you like to create?</h1>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', maxWidth: 780, width: '100%' }}>
        {cards.map(({ type, tag, title, desc }) => (
          <button key={type} onClick={() => onSelect(type)}
            style={{ flex: 1, minWidth: 210, maxWidth: 248, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 5, padding: '24px 20px 20px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'all 0.15s' }}
            onMouseEnter={e => { const el = e.currentTarget; el.style.background = 'rgba(255,255,255,0.07)'; el.style.borderColor = 'rgba(255,255,255,0.18)'; el.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { const el = e.currentTarget; el.style.background = 'rgba(255,255,255,0.04)'; el.style.borderColor = 'rgba(255,255,255,0.08)'; el.style.transform = 'translateY(0)' }}
          >
            <p style={{ fontSize: 8, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.22)', fontWeight: 600, marginBottom: 10 }}>{tag}</p>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'white', marginBottom: 8, letterSpacing: '-0.01em' }}>{title}</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.65, fontWeight: 300, marginBottom: 20, minHeight: 50 }}>{desc}</p>
            <p style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)' }}>Select →</p>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ─── Proposal Builder ──────────────────────────────────────────────────────── */
function ProposalBuilder({ clients, preselectedClientId, onBack }: { clients: Client[]; preselectedClientId?: string; onBack: () => void }) {
  const router = useRouter()
  const [step, setStep]           = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]          = useState<string | null>(null)

  // Step 1
  const [clientId, setClientId]         = useState(preselectedClientId || '')
  const [companyName, setCompanyName]   = useState('')
  const [contactName, setContactName]   = useState('')
  const [contactTitle, setContactTitle] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [siteAddress, setSiteAddress]   = useState('')
  const [proposalDate, setProposalDate] = useState(todayISO())
  const [refNumber]                     = useState(generateRef)

  // Step 2
  const [openingParagraph, setOpeningParagraph] = useState('Thank you for the opportunity to visit your site and put this proposal together. Following our walkthrough, I have a clear picture of your requirements and am confident we can deliver a service that meets the standard your facility deserves.\n\nWe look forward to the opportunity to support your business and to maintain a consistently high standard across your facility. Please do not hesitate to reach out with any questions before making a decision.\n\nWarm regards,\nLaith Humadi\nFounder & Director, Core Cleaning')
  const [additionalNote, setAdditionalNote] = useState('')
  const hasEditedOpening = useRef(false)

  // Step 3
  const [scopeChecked, setScopeChecked] = useState<Record<string, boolean>>({ general: true, bathrooms: true, kitchen: false, reception: false, warehouse: false })
  const [scopeNotes,   setScopeNotes]   = useState<Record<string, string>>({  general: '',  bathrooms: '',  kitchen: '',  reception: '',  warehouse: '' })
  const [otherInclusions, setOtherInclusions] = useState('')

  // Step 4
  const [addlServices, setAddlServices] = useState<Record<string, boolean>>({ pressure: false, carpet: false, vinyl: false, windows: false })

  // Step 5
  const [cleansPerWeek,  setCleansPerWeek]  = useState(2)
  const [preferredDays,  setPreferredDays]  = useState('')
  const [pricePerVisit,  setPricePerVisit]  = useState('')
  const [startDate,      setStartDate]      = useState('')

  const selectedClient = clients.find(c => c.id === clientId)
  const weeklyTotal    = (parseFloat(pricePerVisit) || 0) * cleansPerWeek

  useEffect(() => {
    if (selectedClient) {
      setCompanyName(selectedClient.business_name)
      setContactName(selectedClient.contact_name || '')
      setContactEmail(selectedClient.contact_email || '')
      setSiteAddress([selectedClient.address, selectedClient.suburb, selectedClient.state, selectedClient.postcode].filter(Boolean).join(', '))
      if (!hasEditedOpening.current) {
        setOpeningParagraph(`Thank you for the opportunity to put this proposal together. Following our walkthrough, I have a clear picture of your requirements and am confident we can deliver a service that meets the standard your facility deserves.\n\nWe look forward to the opportunity to support ${selectedClient.business_name} and to maintain a consistently high standard across your facility. Please do not hesitate to reach out with any questions before making a decision.\n\nWarm regards,\nLaith Humadi\nFounder & Director, Core Cleaning`)
      }
    }
  }, [selectedClient?.id])

  const STEPS = ['Client', 'Opening', 'Scope', 'Services', 'Pricing', 'Review']
  const clientDisplay = companyName || selectedClient?.business_name

  function buildContent() {
    return {
      type: 'proposal_v2',
      companyName: clientDisplay || '',
      contactName: contactName || selectedClient?.contact_name || '',
      contactTitle,
      contactEmail: contactEmail || selectedClient?.contact_email || '',
      siteAddress: siteAddress || '',
      proposalDate: proposalDate || todayISO(),
      proposalDateDisplay: proposalDate ? new Date(proposalDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) : '',
      refNumber,
      openingParagraph,
      additionalNote,
      scopeAreas: scopeChecked,
      scopeNotes,
      otherInclusions,
      additionalServices: addlServices,
      cleansPerWeek,
      preferredDays,
      pricePerVisit: parseFloat(pricePerVisit) || 0,
      weeklyTotal,
      startDate,
    }
  }

  async function handleGenerate() {
    if (!clientDisplay) return setError('Please enter a company name or select a client')
    setSubmitting(true); setError(null)
    try {
      const result = await createDocumentAction({
        client_id: clientId || null,
        document_type: 'proposal',
        title: `Commercial Cleaning Proposal — ${clientDisplay}`,
        status: 'draft',
        content: buildContent() as unknown as DocumentContent,
      })
      if ('error' in result) { setError(result.error); setSubmitting(false) }
      else router.push(`/documents/${result.id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
      setSubmitting(false)
    }
  }

  const next = () => { setError(null); setStep(s => s + 1) }
  const back = () => { setError(null); setStep(s => s - 1) }

  return (
    <BuilderShell docLabel="Proposal" docSub="Commercial cleaning" steps={STEPS} step={step} onBack={onBack} clientName={clientDisplay}>
      {error && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626', fontSize: 12, borderRadius: 3, padding: '10px 14px', marginBottom: 20 }}>{error}</div>}

      {/* Step 1 — Client */}
      {step === 0 && (
        <div>
          <PanelEyebrow n={1} total={6} />
          <PanelHeading>Client details</PanelHeading>
          <PanelSub>Select a saved client to autofill, or enter details below.</PanelSub>

          {clients.length > 0 && (
            <div style={{ marginBottom: 4 }}>
              <FieldLabel>Saved clients</FieldLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, marginBottom: 4 }}>
                {clients.map(c => (
                  <button key={c.id} onClick={() => setClientId(clientId === c.id ? '' : c.id)}
                    style={{ padding: '6px 13px', border: `1px solid ${clientId === c.id ? INK : RULE}`, borderRadius: 100, fontSize: 11, color: clientId === c.id ? 'white' : INK_MID, background: clientId === c.id ? INK : SURFACE, cursor: 'pointer', fontFamily: 'inherit', fontWeight: clientId === c.id ? 500 : 400, transition: 'all 0.12s' }}>
                    {c.business_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Divider />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div><FieldLabel>Company name</FieldLabel><input style={inp} value={companyName} onChange={e => { setClientId(''); setCompanyName(e.target.value) }} placeholder="e.g. Parkside Group" /></div>
            <div><FieldLabel>Contact person</FieldLabel><input style={inp} value={contactName} onChange={e => setContactName(e.target.value)} placeholder="e.g. Ashleigh Muller" /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div><FieldLabel>Contact title</FieldLabel><input style={inp} value={contactTitle} onChange={e => setContactTitle(e.target.value)} placeholder="e.g. Office Manager" /></div>
            <div><FieldLabel>Contact email</FieldLabel><input style={inp} type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="e.g. ashleigh@company.com.au" /></div>
          </div>
          <div style={{ marginBottom: 12 }}><FieldLabel>Site address</FieldLabel><input style={inp} value={siteAddress} onChange={e => setSiteAddress(e.target.value)} placeholder="e.g. 469 Nudgee Rd, Hendra QLD 4011" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><FieldLabel>Proposal date</FieldLabel><input style={inp} type="date" value={proposalDate} onChange={e => setProposalDate(e.target.value)} /></div>
            <div><FieldLabel>Reference no.</FieldLabel><input style={{ ...inp, color: INK_FAINT }} value={refNumber} readOnly /></div>
          </div>

          <PanelNav onNext={() => { if (!clientDisplay) return setError('Enter a company name or select a client'); next() }} />
        </div>
      )}

      {/* Step 2 — Opening message */}
      {step === 1 && (
        <div>
          <PanelEyebrow n={2} total={6} />
          <PanelHeading>Opening message</PanelHeading>
          <PanelSub>A personal note from Laith following the site walkthrough.</PanelSub>
          <div style={{ marginBottom: 20 }}>
            <FieldLabel>Opening paragraph</FieldLabel>
            <p style={{ fontSize: 10.5, color: INK_FAINT, marginBottom: 8 }}>Appears after "Dear [Name]," in the introduction letter</p>
            <textarea style={{ ...inp, minHeight: 140, resize: 'vertical', lineHeight: 1.7 }} value={openingParagraph}
              onChange={e => { hasEditedOpening.current = true; setOpeningParagraph(e.target.value) }} />
          </div>
          <div>
            <FieldLabel optional>Additional note</FieldLabel>
            <textarea style={{ ...inp, minHeight: 72, resize: 'vertical', lineHeight: 1.7 }} value={additionalNote} onChange={e => setAdditionalNote(e.target.value)} placeholder="e.g. We noted the server room access requirement and will brief our team accordingly." />
          </div>
          <PanelNav onBack={back} onNext={next} />
        </div>
      )}

      {/* Step 3 — Scope */}
      {step === 2 && (
        <div>
          <PanelEyebrow n={3} total={6} />
          <PanelHeading>Scope of services</PanelHeading>
          <PanelSub>Toggle each area covered at this site and add walkthrough notes.</PanelSub>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {SCOPE_AREAS.map(area => {
              const isOn = scopeChecked[area.key]
              return (
                <div key={area.key} style={{ background: SURFACE, border: `1px solid ${isOn ? INK : RULE}`, borderRadius: 3, overflow: 'hidden', transition: 'border-color 0.15s' }}>
                  <div onClick={() => setScopeChecked(p => ({ ...p, [area.key]: !isOn }))}
                    style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', cursor: 'pointer', userSelect: 'none' }}>
                    <CheckBox checked={isOn} />
                    <span style={{ flex: 1, fontSize: 11.5, fontWeight: 600, color: INK }}>{area.label}</span>
                    <span style={{ fontSize: 10, color: INK_FAINT }}>{area.summary}</span>
                  </div>
                  {isOn && (
                    <div style={{ padding: '0 13px 12px', borderTop: `1px solid ${RULE_LIGHT}` }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '10px 0 10px' }}>
                        {area.tags.map(tag => <span key={tag} style={{ fontSize: 9.5, color: INK_SOFT, background: SURFACE_OFF, padding: '3px 9px', borderRadius: 100 }}>{tag}</span>)}
                      </div>
                      <p style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: INK_FAINT, marginBottom: 4 }}>Site notes from walkthrough</p>
                      <textarea value={scopeNotes[area.key] || ''} onChange={e => setScopeNotes(p => ({ ...p, [area.key]: e.target.value }))}
                        placeholder="e.g. Open plan for 15 staff, 2 private offices…"
                        style={{ width: '100%', fontFamily: 'inherit', fontSize: 11.5, color: INK, background: SURFACE_OFF, border: `1px solid ${RULE_LIGHT}`, borderRadius: 2, padding: '7px 10px', outline: 'none', resize: 'vertical', minHeight: 50, lineHeight: 1.6, boxSizing: 'border-box' }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div><FieldLabel optional>Other inclusions</FieldLabel>
            <textarea value={otherInclusions} onChange={e => setOtherInclusions(e.target.value)} placeholder="e.g. Stairwell, rooftop terrace, car park sweep" style={{ ...inp, minHeight: 56, resize: 'vertical', lineHeight: 1.7 }} />
          </div>
          <PanelNav onBack={back} onNext={() => { if (!Object.values(scopeChecked).some(Boolean)) return setError('Select at least one service area'); next() }} />
        </div>
      )}

      {/* Step 4 — Additional services */}
      {step === 3 && (
        <div>
          <PanelEyebrow n={4} total={6} />
          <PanelHeading>Additional services</PanelHeading>
          <PanelSub>Optional specialist services to include in this proposal.</PanelSub>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ADDITIONAL_SERVICES.map(svc => {
              const isOn = addlServices[svc.key]
              return (
                <div key={svc.key} onClick={() => setAddlServices(p => ({ ...p, [svc.key]: !isOn }))}
                  style={{ background: SURFACE, border: `1px solid ${isOn ? INK : RULE}`, borderRadius: 3, padding: '12px 13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, userSelect: 'none', transition: 'border-color 0.15s' }}>
                  <CheckBox checked={isOn} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 11.5, fontWeight: 600, color: INK, marginBottom: 2 }}>{svc.label}</p>
                    <p style={{ fontSize: 10.5, color: INK_SOFT, fontWeight: 300 }}>{svc.desc}</p>
                  </div>
                  <span style={{ fontSize: 11, color: INK_FAINT, fontWeight: 500, flexShrink: 0 }}>{svc.price}</span>
                </div>
              )
            })}
          </div>
          <PanelNav onBack={back} onNext={next} />
        </div>
      )}

      {/* Step 5 — Pricing */}
      {step === 4 && (
        <div>
          <PanelEyebrow n={5} total={6} />
          <PanelHeading>Schedule & pricing</PanelHeading>
          <PanelSub>Set the service frequency, preferred days, and investment.</PanelSub>
          <div style={{ marginBottom: 20 }}>
            <FieldLabel>Cleans per week</FieldLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 8 }}>
              {CLEANS_OPTIONS.map(n => (
                <button key={n} onClick={() => setCleansPerWeek(n)}
                  style={{ padding: '14px 8px', border: `1px solid ${cleansPerWeek === n ? INK : RULE}`, borderRadius: 3, background: cleansPerWeek === n ? INK : SURFACE, color: cleansPerWeek === n ? 'white' : INK, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center', transition: 'all 0.12s' }}>
                  <div style={{ fontSize: 24, fontWeight: 300, lineHeight: 1, marginBottom: 3 }}>{n}</div>
                  <div style={{ fontSize: 8, letterSpacing: '0.08em', opacity: 0.5, textTransform: 'uppercase' }}>/WK</div>
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 14 }}><FieldLabel>Preferred day(s)</FieldLabel><input style={inp} value={preferredDays} onChange={e => setPreferredDays(e.target.value)} placeholder="e.g. Monday, Wednesday, Friday" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div><FieldLabel>Price per visit (excl. GST)</FieldLabel><input style={inp} type="number" min="0" step="5" value={pricePerVisit} onChange={e => setPricePerVisit(e.target.value)} placeholder="e.g. 150" /></div>
            <div><FieldLabel>Weekly total (excl. GST)</FieldLabel><input style={{ ...inp, color: weeklyTotal > 0 ? INK : INK_FAINT, background: SURFACE_OFF }} value={weeklyTotal > 0 ? `$${weeklyTotal.toFixed(2)}` : ''} readOnly placeholder="—" /></div>
          </div>
          <div><FieldLabel>Proposed start date</FieldLabel><input style={inp} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
          <PanelNav onBack={back} onNext={next} />
        </div>
      )}

      {/* Step 6 — Review */}
      {step === 5 && (
        <div>
          <PanelEyebrow n={6} total={6} />
          <PanelHeading>Review & generate</PanelHeading>
          <PanelSub>Check everything looks right, then generate the proposal.</PanelSub>
          {[
            { title: 'CLIENT',       rows: [['Company', clientDisplay || '—'], ['Contact', contactName || selectedClient?.contact_name || '—'], ['Address', siteAddress || '—']] },
            { title: 'SCOPE',        rows: [['Areas', SCOPE_AREAS.filter(a => scopeChecked[a.key]).map(a => a.label).join(', ') || '—'], ['Additional', Object.entries(addlServices).filter(([, v]) => v).map(([k]) => ADDITIONAL_SERVICES.find(s => s.key === k)?.label).filter(Boolean).join(', ') || 'None']] },
            { title: 'SCHEDULE',     rows: [['Frequency', `${cleansPerWeek}× per week`], ['Days', preferredDays || '—'], ['Per visit', pricePerVisit ? `$${parseFloat(pricePerVisit).toFixed(2)}` : '—'], ['Weekly total', weeklyTotal > 0 ? `$${weeklyTotal.toFixed(2)}` : '—']] },
          ].map(card => (
            <div key={card.title} style={{ background: SURFACE, border: `1px solid ${RULE}`, borderRadius: 3, overflow: 'hidden', marginBottom: 10 }}>
              <div style={{ padding: '10px 16px', borderBottom: `1px solid ${RULE_LIGHT}` }}><span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: INK_FAINT }}>{card.title}</span></div>
              <div style={{ padding: '4px 16px 8px' }}>
                {card.rows.map(([l, v]) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${RULE_LIGHT}`, fontSize: 12.5, gap: 12 }}>
                    <span style={{ color: INK_SOFT }}>{l}</span>
                    <span style={{ color: INK, textAlign: 'right' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={handleGenerate} disabled={submitting}
              style={{ width: '100%', fontFamily: 'inherit', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', background: INK, color: 'white', border: 'none', padding: 14, borderRadius: 3, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1 }}>
              {submitting ? 'Generating…' : 'Generate Proposal'}
            </button>
            <button onClick={back} style={{ fontFamily: 'inherit', fontSize: 10.5, fontWeight: 500, color: INK_SOFT, background: 'none', border: 'none', padding: '8px 0', cursor: 'pointer', textAlign: 'left' }}>Back</button>
          </div>
        </div>
      )}
    </BuilderShell>
  )
}

/* ─── Agreement Builder ─────────────────────────────────────────────────────── */
function AgreementBuilder({ docType, clients, preselectedClientId, onBack }: { docType: DocumentType; clients: Client[]; preselectedClientId?: string; onBack: () => void }) {
  const router = useRouter()
  const [step, setStep]             = useState(0)
  const [clientId, setClientId]     = useState(preselectedClientId || '')
  const [title, setTitle]           = useState('')
  const [scopeOn, setScopeOn]       = useState<Record<string, boolean>>({ general_cleaning: true, window_cleaning: false, floor_care: false, pressure_washing: false })
  const [scopeNotes, setScopeNotes] = useState<Record<string, string>>({ general_cleaning: '', window_cleaning: '', floor_care: '', pressure_washing: '' })
  const [frequency, setFrequency]   = useState<FrequencyType>('weekly')
  const [ratePerVisit, setRatePerVisit] = useState('')
  const [gstInclusive, setGstInclusive] = useState(true)
  const [commencementDate, setCommencementDate] = useState('')
  const [contractLength, setContractLength]     = useState('12 months')
  const [noticePeriod, setNoticePeriod]         = useState('30 days')
  const [paymentTerms, setPaymentTerms]         = useState('14 days')
  const [specialInstructions, setSpecialInstructions] = useState('')
  const [terminationClause]                     = useState('Standard Core Cleaning terms apply.')
  const [signatoryName, setSignatoryName]       = useState('')
  const [signatoryTitle, setSignatoryTitle]     = useState('')
  const [specialistType, setSpecialistType]     = useState('Pressure Washing')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)

  const selectedClient  = clients.find(c => c.id === clientId)
  const rateNum         = parseFloat(ratePerVisit) || 0
  const breakdown       = rateNum > 0 ? calculateBillingBreakdown(rateNum, frequency) : null
  const selectedServices = Object.entries(scopeOn).filter(([, on]) => on).map(([k]) => k as ServiceType)
  const isSpecialist    = docType === 'specialist_agreement'
  const docLabel        = isSpecialist ? 'Specialist Agreement' : 'Cleaning Agreement'
  const SERVICES        = Object.entries(SERVICE_TYPE_LABELS) as [ServiceType, string][]

  const STEPS = isSpecialist
    ? ['Client', 'Service & scope', 'Pricing', 'Review']
    : ['Client', 'Scope', 'Pricing', 'Agreement', 'Review']

  function buildContent(): DocumentContent {
    const base: DocumentContent = {
      clientId, clientName: selectedClient?.business_name || '',
      clientAddress: [selectedClient?.address, selectedClient?.suburb, selectedClient?.state, selectedClient?.postcode].filter(Boolean).join(', '),
      contactName: selectedClient?.contact_name || null, clientEmail: selectedClient?.contact_email || null,
      generatedDate: new Date().toISOString(),
      billing: { serviceTypes: selectedServices, frequency, ratePerVisit: rateNum, monthlyValue: breakdown?.monthlyValue || 0, annualValue: breakdown?.annualValue || 0, visitsPerMonth: breakdown?.visitsPerMonth || 0, gstInclusive },
    }
    if (docType === 'cleaning_agreement')   base.cleaningAgreement   = { commencementDate, contractLength, noticePeriod, specialInstructions, paymentTerms, terminationClause, signatoryName, signatoryTitle }
    if (docType === 'specialist_agreement') base.specialistAgreement = { specialistServiceType: specialistType, commencementDate, specialConditions: specialInstructions, signatoryName, signatoryTitle }
    return base
  }

  async function handleGenerate(status: 'draft' | 'sent') {
    if (!clientId) return setError('Please select a client')
    setSubmitting(true); setError(null)
    try {
      const result = await createDocumentAction({
        client_id: clientId,
        document_type: docType,
        title: title || `${docLabel} — ${selectedClient?.business_name || ''}`,
        status,
        content: buildContent(),
      })
      if ('error' in result) { setError(result.error); setSubmitting(false) }
      else router.push(`/documents/${result.id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
      setSubmitting(false)
    }
  }

  const next = () => { setError(null); setStep(s => s + 1) }
  const back = () => { setError(null); setStep(s => s - 1) }
  const FREQ_LABEL: Record<string, string> = { daily: 'Daily', weekly: 'Weekly', fortnightly: 'Fortnightly', monthly: 'Monthly', quarterly: 'Quarterly', annual: 'Annual', one_off: 'One-off' }

  return (
    <BuilderShell docLabel={docLabel} docSub={isSpecialist ? 'Specialist service' : 'Ongoing contract'} steps={STEPS} step={step} onBack={onBack} clientName={selectedClient?.business_name}>
      {error && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626', fontSize: 12, borderRadius: 3, padding: '10px 14px', marginBottom: 20 }}>{error}</div>}

      {/* Step 1 — Client */}
      {step === 0 && (
        <div>
          <PanelEyebrow n={1} total={STEPS.length} />
          <PanelHeading>Select client</PanelHeading>
          <PanelSub>Choose the client this {docLabel.toLowerCase()} is for.</PanelSub>
          <FieldLabel>Saved clients</FieldLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, marginBottom: 20 }}>
            {clients.map(c => (
              <button key={c.id} onClick={() => setClientId(c.id)}
                style={{ padding: '6px 13px', border: `1px solid ${clientId === c.id ? INK : RULE}`, borderRadius: 100, fontSize: 11, color: clientId === c.id ? 'white' : INK_MID, background: clientId === c.id ? INK : SURFACE, cursor: 'pointer', fontFamily: 'inherit', fontWeight: clientId === c.id ? 500 : 400, transition: 'all 0.12s' }}>
                {c.business_name}
              </button>
            ))}
          </div>
          <div><FieldLabel optional>Document title</FieldLabel><input style={inp} value={title} onChange={e => setTitle(e.target.value)} placeholder={`${docLabel} — ${selectedClient?.business_name || 'Client'}`} /></div>
          <PanelNav onNext={() => { if (!clientId) return setError('Please select a client'); next() }} />
        </div>
      )}

      {/* Step 2 — Scope */}
      {step === 1 && (
        <div>
          <PanelEyebrow n={2} total={STEPS.length} />
          <PanelHeading>{isSpecialist ? 'Service & scope' : 'Scope of services'}</PanelHeading>
          <PanelSub>Toggle each service area included in this agreement.</PanelSub>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {SERVICES.map(([key, label]) => {
              const isOn = scopeOn[key]
              return (
                <div key={key} style={{ background: SURFACE, border: `1px solid ${isOn ? INK : RULE}`, borderRadius: 3, overflow: 'hidden' }}>
                  <div onClick={() => setScopeOn(p => ({ ...p, [key]: !isOn }))}
                    style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', cursor: 'pointer', userSelect: 'none' }}>
                    <CheckBox checked={isOn} />
                    <span style={{ flex: 1, fontSize: 11.5, fontWeight: 600, color: INK }}>{label}</span>
                    <span style={{ fontSize: 10, color: INK_FAINT }}>{isOn ? 'Included' : 'Not included'}</span>
                  </div>
                  {isOn && (
                    <div style={{ padding: '0 13px 12px', borderTop: `1px solid ${RULE_LIGHT}` }}>
                      <textarea value={scopeNotes[key] || ''} onChange={e => setScopeNotes(p => ({ ...p, [key]: e.target.value }))}
                        placeholder="Site-specific notes…"
                        style={{ ...inp, marginTop: 10, minHeight: 52, resize: 'vertical', lineHeight: 1.7, background: SURFACE_OFF }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {isSpecialist && (
            <div style={{ marginBottom: 16 }}>
              <FieldLabel>Specialist type</FieldLabel>
              <select style={inp} value={specialistType} onChange={e => setSpecialistType(e.target.value)}>
                {['Pressure Washing', 'Window Cleaning', 'Floor Care', 'Carpet Extraction'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          )}
          <PanelNav onBack={back} onNext={next} />
        </div>
      )}

      {/* Step 3 — Pricing */}
      {step === 2 && (
        <div>
          <PanelEyebrow n={3} total={STEPS.length} />
          <PanelHeading>Schedule & pricing</PanelHeading>
          <PanelSub>Set the service frequency and investment for this client.</PanelSub>
          <div style={{ marginBottom: 20 }}>
            <FieldLabel>Service frequency</FieldLabel>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {FREQUENCY_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setFrequency(opt.value)}
                  style={{ flex: 1, minWidth: 60, padding: '11px 6px', border: `1px solid ${frequency === opt.value ? INK : RULE}`, borderRadius: 3, textAlign: 'center', cursor: 'pointer', background: frequency === opt.value ? INK : SURFACE, color: frequency === opt.value ? 'white' : INK, fontFamily: 'inherit', transition: 'all 0.12s' }}>
                  <span style={{ fontSize: 20, fontWeight: 300, display: 'block', lineHeight: 1, marginBottom: 2 }}>{opt.label}</span>
                  <span style={{ fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>{opt.sub}</span>
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div><FieldLabel>Rate per visit (AUD)</FieldLabel><input type="number" min="0" step="0.01" style={inp} value={ratePerVisit} onChange={e => setRatePerVisit(e.target.value)} placeholder="0.00" /></div>
            <div><FieldLabel>Commencement date</FieldLabel><input type="date" style={inp} value={commencementDate} onChange={e => setCommencementDate(e.target.value)} /></div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 16, fontSize: 12, color: INK_SOFT }}>
            <input type="checkbox" checked={gstInclusive} onChange={e => setGstInclusive(e.target.checked)} />
            Prices include GST
          </label>
          {breakdown && (
            <div style={{ background: SURFACE, border: `1px solid ${RULE}`, borderRadius: 3, padding: '14px 18px', marginBottom: 8 }}>
              {[['Rate per visit', formatAUD(breakdown.ratePerVisit)], ['Visits / month', breakdown.visitsPerMonth.toFixed(2)], ['Monthly value', formatAUD(breakdown.monthlyValue)], ['Annual value', formatAUD(breakdown.annualValue)]].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '5px 0', color: INK_SOFT, borderBottom: `1px solid ${RULE_LIGHT}` }}>
                  <span>{l}</span><strong style={{ color: INK }}>{v}</strong>
                </div>
              ))}
            </div>
          )}
          <PanelNav onBack={back} onNext={next} />
        </div>
      )}

      {/* Step 4 — Agreement details (cleaning only) */}
      {step === 3 && !isSpecialist && (
        <div>
          <PanelEyebrow n={4} total={STEPS.length} />
          <PanelHeading>Agreement details</PanelHeading>
          <PanelSub>Set the contract term, notice period, and payment terms.</PanelSub>
          {[
            { label: 'Contract length', opts: CONTRACT_LENGTHS,   value: contractLength, set: setContractLength },
            { label: 'Notice period',   opts: NOTICE_PERIODS,     value: noticePeriod,   set: setNoticePeriod },
            { label: 'Payment terms',   opts: PAYMENT_TERMS_OPTS, value: paymentTerms,   set: setPaymentTerms },
          ].map(({ label, opts, value, set }) => (
            <div key={label} style={{ marginBottom: 20 }}>
              <FieldLabel>{label}</FieldLabel>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {opts.map(o => (
                  <button key={o} onClick={() => set(o)}
                    style={{ padding: '9px 14px', border: `1px solid ${value === o ? INK : RULE}`, borderRadius: 3, fontSize: 12, fontWeight: 500, color: value === o ? 'white' : INK, background: value === o ? INK : SURFACE, fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.12s' }}>
                    {o}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div style={{ marginBottom: 14 }}><FieldLabel optional>Special instructions</FieldLabel>
            <textarea value={specialInstructions} onChange={e => setSpecialInstructions(e.target.value)} placeholder="Site-specific requirements…" style={{ ...inp, minHeight: 76, resize: 'vertical', lineHeight: 1.65 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><FieldLabel>Signatory name</FieldLabel><input value={signatoryName} onChange={e => setSignatoryName(e.target.value)} placeholder="Client contact name" style={inp} /></div>
            <div><FieldLabel optional>Title / role</FieldLabel><input value={signatoryTitle} onChange={e => setSignatoryTitle(e.target.value)} placeholder="e.g. Practice Manager" style={inp} /></div>
          </div>
          <PanelNav onBack={back} onNext={next} />
        </div>
      )}

      {/* Final review step */}
      {((isSpecialist && step === 3) || (!isSpecialist && step === 4)) && (
        <div>
          <PanelEyebrow n={STEPS.length} total={STEPS.length} />
          <PanelHeading>Review & generate</PanelHeading>
          <PanelSub>Check everything looks right before generating the document.</PanelSub>
          {[
            { title: 'CLIENT',   rows: [['Business', selectedClient?.business_name || '—'], ['Contact', selectedClient?.contact_name || '—'], ['Suburb', selectedClient?.suburb || '—']] },
            { title: 'DOCUMENT', rows: [['Type', docLabel], ['Services', selectedServices.map(s => SERVICE_TYPE_LABELS[s]).join(', ') || '—'], ...(isSpecialist ? [['Specialist type', specialistType]] as [string, string][] : [])] },
            ...(breakdown ? [{ title: 'PRICING', rows: [['Frequency', FREQ_LABEL[frequency] || frequency], ['Rate / visit', formatAUD(breakdown.ratePerVisit)], ['Monthly value', formatAUD(breakdown.monthlyValue)], ['Annual value', formatAUD(breakdown.annualValue)]] }] : []),
            ...(!isSpecialist ? [{ title: 'TERMS', rows: [['Commencement', commencementDate || '—'], ['Contract length', contractLength], ['Notice period', noticePeriod], ['Payment terms', paymentTerms]] }] : []),
          ].map(card => (
            <div key={card.title} style={{ background: SURFACE, border: `1px solid ${RULE}`, borderRadius: 3, overflow: 'hidden', marginBottom: 10 }}>
              <div style={{ padding: '10px 16px', borderBottom: `1px solid ${RULE_LIGHT}` }}><span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: INK_FAINT }}>{card.title}</span></div>
              <div style={{ padding: '4px 16px 8px' }}>
                {card.rows.map(([l, v]) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '5px 0', color: INK_SOFT, borderBottom: `1px solid ${RULE_LIGHT}`, gap: 12 }}>
                    <span>{l}</span><strong style={{ color: INK, fontWeight: 500 }}>{v}</strong>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
            <button onClick={() => handleGenerate('sent')} disabled={submitting}
              style={{ fontFamily: 'inherit', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', background: submitting ? '#888' : INK, color: 'white', border: 'none', padding: 14, borderRadius: 3, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1 }}>
              {submitting ? 'Generating…' : 'Generate & mark as sent'}
            </button>
            <button onClick={() => handleGenerate('draft')} disabled={submitting}
              style={{ fontFamily: 'inherit', fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: INK, background: 'transparent', border: `1.5px solid ${INK}`, padding: 12, borderRadius: 3, cursor: submitting ? 'not-allowed' : 'pointer' }}>
              Save as draft
            </button>
            <button onClick={back} style={{ fontFamily: 'inherit', fontSize: 10.5, fontWeight: 500, color: INK_SOFT, background: 'none', border: 'none', padding: '8px 0', cursor: 'pointer', textAlign: 'left' }}>Back</button>
          </div>
        </div>
      )}
    </BuilderShell>
  )
}
