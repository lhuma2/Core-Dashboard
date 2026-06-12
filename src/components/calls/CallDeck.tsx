'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Phone, PhoneCall, PhoneMissed, MessageSquare, Mail, MailCheck,
  CalendarClock, Footprints, Trash2, Plus, Search, X, Check,
  ThumbsDown, Flame, Upload,
} from 'lucide-react'
import {
  importColdLeadsAction, logCallAction, deleteColdLeadAction,
  sendIntroEmailAction, markIntroSmsSentAction, setFollowUpAction,
  type ColdLead,
} from '@/actions/cold-leads'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function brisbaneToday(): string {
  return new Date().toLocaleString('en-AU', {
    timeZone: 'Australia/Brisbane', year: 'numeric', month: '2-digit', day: '2-digit',
  }).split('/').reverse().join('-')
}

function cleanPhone(p: string): string {
  return p.replace(/[^\d+]/g, '')
}

function smsBody(lead: ColdLead): string {
  const first = (lead.contact_name || '').split(' ')[0]
  const hi = first ? `Hi ${first}, ` : 'Hi, '
  return (
    `${hi}Jackson from Delta Cleaning here — just tried calling about cleaning for ${lead.business_name}. ` +
    `Happy to come past for a free 15-min walk-through and put a fixed monthly price on it, whenever suits. Jackson`
  )
}

const STATUS_META: Record<ColdLead['status'], { label: string; cls: string }> = {
  new:            { label: 'New',            cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  called:         { label: 'Called',         cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  follow_up:      { label: 'Follow up',      cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  walkthrough:    { label: 'Walk-through',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  converted:      { label: 'Won',            cls: 'bg-[#1e3a5f] text-white border-[#1e3a5f]' },
  not_interested: { label: 'Not interested', cls: 'bg-red-50 text-red-500 border-red-200' },
}

type Tab = 'queue' | 'booked' | 'all'

// ─── Lead card ───────────────────────────────────────────────────────────────

function LeadCard({ lead, dueToday, onChanged }: { lead: ColdLead; dueToday: boolean; onChanged: () => void }) {
  const [logging, setLogging] = useState(false)       // outcome bar visible
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pickDate, setPickDate] = useState<'follow_up' | 'walkthrough' | null>(null)
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [flash, setFlash] = useState<string | null>(null)

  async function outcome(kind: 'no_answer' | 'spoke' | 'not_interested') {
    setBusy(kind)
    await logCallAction(lead.id, kind)
    setBusy(null)
    setLogging(false)
    onChanged()
  }

  async function outcomeWithDate() {
    if (!pickDate || !date) return
    setBusy(pickDate)
    await logCallAction(lead.id, pickDate, date, note)
    setBusy(null)
    setPickDate(null)
    setLogging(false)
    setDate(''); setNote('')
    onChanged()
  }

  async function sendIntro() {
    setBusy('email')
    const res = await sendIntroEmailAction(lead.id)
    setBusy(null)
    setFlash(res.error ? res.error : 'Intro email sent')
    setTimeout(() => setFlash(null), 2500)
    onChanged()
  }

  function openSms() {
    if (!lead.phone) return
    markIntroSmsSentAction(lead.id).then(onChanged)
    window.location.href = `sms:${cleanPhone(lead.phone)}&body=${encodeURIComponent(smsBody(lead))}`
  }

  const s = STATUS_META[lead.status]

  return (
    <div className={`bg-white rounded-2xl border shadow-[0_1px_2px_rgba(16,24,40,0.05)] overflow-hidden transition-all ${
      dueToday ? 'border-amber-300 ring-1 ring-amber-200' : 'border-gray-200/70'
    }`}>
      {dueToday && (
        <div className="px-4 py-1.5 bg-amber-50 border-b border-amber-100 flex items-center gap-1.5">
          <Flame className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-xs font-semibold text-amber-700">
            Follow up due today{lead.follow_up_note ? ` — ${lead.follow_up_note}` : ''}
          </span>
        </div>
      )}

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-[17px] font-bold text-gray-900 leading-snug truncate">{lead.business_name}</p>
            <p className="text-xs text-gray-400 mt-0.5 truncate">
              {[lead.contact_name, lead.suburb, lead.industry].filter(Boolean).join(' · ') || '—'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {lead.call_count > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-500 bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5 tabular-nums">
                <PhoneCall className="w-3 h-3" />{lead.call_count}
              </span>
            )}
            <span className={`text-[11px] font-semibold border rounded-full px-2 py-0.5 ${s.cls}`}>{s.label}</span>
          </div>
        </div>

        {/* Follow-up line */}
        {lead.next_follow_up && !dueToday && (
          <p className="flex items-center gap-1.5 text-xs text-gray-500 mt-2">
            <CalendarClock className="w-3.5 h-3.5 text-gray-400" />
            Follow up {new Date(lead.next_follow_up + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
            {lead.follow_up_note ? ` — ${lead.follow_up_note}` : ''}
          </p>
        )}

        {flash && (
          <p className="text-xs font-medium text-emerald-600 mt-2">{flash}</p>
        )}

        {/* Action row */}
        {!logging && !pickDate && (
          <div className="flex items-center gap-2 mt-3.5">
            {lead.phone ? (
              <a
                href={`tel:${cleanPhone(lead.phone)}`}
                onClick={() => setLogging(true)}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-[#1e3a5f] hover:bg-[#162d4a] active:scale-[0.98] text-white text-sm font-semibold rounded-xl py-3 shadow-[0_4px_12px_rgba(30,58,95,0.25)] transition-all"
              >
                <Phone className="w-4 h-4" /> Call
              </a>
            ) : (
              <span className="flex-1 text-center text-xs text-gray-400 py-3">No phone number</span>
            )}

            {lead.phone && (
              <button
                onClick={openSms}
                title="Send intro text"
                className={`p-3 rounded-xl border transition-colors ${
                  lead.intro_sms_sent_at
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                    : 'bg-white border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
              </button>
            )}

            {lead.email && (
              <button
                onClick={sendIntro}
                disabled={busy === 'email'}
                title={lead.intro_email_sent_at ? 'Intro email already sent — send again' : 'Send intro email'}
                className={`p-3 rounded-xl border transition-colors disabled:opacity-50 ${
                  lead.intro_email_sent_at
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                    : 'bg-white border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                {lead.intro_email_sent_at ? <MailCheck className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
              </button>
            )}

            <button
              onClick={() => setLogging(true)}
              title="Log an outcome"
              className="p-3 rounded-xl border bg-white border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-300 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>

            {confirmDelete ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={async () => { setBusy('del'); await deleteColdLeadAction(lead.id); onChanged() }}
                  disabled={busy === 'del'}
                  className="p-3 rounded-xl bg-red-600 text-white"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => setConfirmDelete(false)} className="p-3 rounded-xl border border-gray-200 text-gray-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                title="Remove lead"
                className="p-3 rounded-xl border bg-white border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-200 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Outcome bar — appears after tapping Call (or +) */}
        {logging && !pickDate && (
          <div className="mt-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-2">How did it go?</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <button onClick={() => outcome('no_answer')} disabled={!!busy}
                className="flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 rounded-xl border border-gray-200 bg-white text-gray-600 hover:border-gray-400 active:scale-[0.98] transition-all">
                <PhoneMissed className="w-3.5 h-3.5" /> No answer
              </button>
              <button onClick={() => outcome('spoke')} disabled={!!busy}
                className="flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 rounded-xl border border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-400 active:scale-[0.98] transition-all">
                <PhoneCall className="w-3.5 h-3.5" /> Spoke
              </button>
              <button onClick={() => { setPickDate('follow_up'); setDate('') }} disabled={!!busy}
                className="flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-400 active:scale-[0.98] transition-all">
                <CalendarClock className="w-3.5 h-3.5" /> Follow up
              </button>
              <button onClick={() => { setPickDate('walkthrough'); setDate('') }} disabled={!!busy}
                className="flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-400 active:scale-[0.98] transition-all">
                <Footprints className="w-3.5 h-3.5" /> Walk-through
              </button>
              <button onClick={() => outcome('not_interested')} disabled={!!busy}
                className="flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-600 hover:border-red-400 active:scale-[0.98] transition-all col-span-2 sm:col-span-1">
                <ThumbsDown className="w-3.5 h-3.5" /> Not interested
              </button>
            </div>
            <button onClick={() => setLogging(false)} className="text-xs text-gray-400 hover:text-gray-600 mt-2">
              Cancel
            </button>
          </div>
        )}

        {/* Date picker for follow-up / walkthrough */}
        {pickDate && (
          <div className="mt-3.5 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
              {pickDate === 'walkthrough' ? 'Walk-through date' : 'Follow up on'}
            </p>
            <input
              type="date"
              value={date}
              min={brisbaneToday()}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-white border border-gray-200 text-gray-900 rounded-xl px-3 py-3 text-[16px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            />
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={pickDate === 'walkthrough' ? 'e.g. 10am, ask for Sarah' : 'e.g. call back after 2pm'}
              className="w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl px-3 py-3 text-[16px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            />
            <div className="flex gap-2">
              <button
                onClick={outcomeWithDate}
                disabled={!date || !!busy}
                className="flex-1 bg-[#1e3a5f] text-white text-sm font-semibold rounded-xl py-2.5 disabled:opacity-40 active:scale-[0.98] transition-all"
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setPickDate(null)} className="px-4 text-sm text-gray-400 hover:text-gray-600">
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Import modal ────────────────────────────────────────────────────────────

function ImportPanel({ onClose, onDone }: { onClose: () => void; onDone: (msg: string) => void }) {
  const [csv, setCsv] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setBusy(true)
    setError(null)
    const res = await importColdLeadsAction(csv) as any
    setBusy(false)
    if (res.error) { setError(res.error); return }
    onDone(`${res.imported} lead${res.imported === 1 ? '' : 's'} imported${res.skipped ? ` · ${res.skipped} duplicate${res.skipped === 1 ? '' : 's'} skipped` : ''}`)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => setCsv(String(reader.result || ''))
    reader.readAsText(f)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-gray-200 shadow-xl p-6 max-h-[92dvh] overflow-y-auto">
        <div className="flex items-start justify-between mb-1">
          <h3 className="font-display text-lg font-bold text-gray-900">Import leads</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-400 mb-4 leading-relaxed">
          In Google Sheets: File → Download → CSV, then upload it here (or paste the rows straight in).
          Columns are detected automatically — business name, contact, phone, email, suburb, industry.
        </p>

        <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 hover:border-[#1e3a5f]/40 rounded-xl py-6 cursor-pointer text-sm font-medium text-gray-500 hover:text-[#1e3a5f] transition-colors mb-3">
          <Upload className="w-4 h-4" />
          Choose CSV file
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
        </label>

        <textarea
          value={csv}
          onChange={e => setCsv(e.target.value)}
          rows={6}
          placeholder={'Or paste here, e.g.\nBusiness,Contact,Phone,Email,Suburb\nAcme Dental,Sarah Smith,0400 111 222,sarah@acme.com,Chermside'}
          className="w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl px-3 py-3 text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
        />

        {error && (
          <div className="mt-3 rounded-xl bg-red-50 border border-red-100 px-3 py-2.5 text-sm text-red-600">{error}</div>
        )}

        <button
          onClick={run}
          disabled={!csv.trim() || busy}
          className="w-full mt-4 bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-sm font-semibold rounded-xl py-3.5 disabled:opacity-40 active:scale-[0.99] transition-all"
        >
          {busy ? 'Importing…' : 'Import leads'}
        </button>
      </div>
    </div>
  )
}

// ─── Deck ────────────────────────────────────────────────────────────────────

export function CallDeck({ initialLeads }: { initialLeads: ColdLead[] }) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('queue')
  const [search, setSearch] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const leads = initialLeads
  const today = brisbaneToday()

  const refresh = () => router.refresh()

  const dueToday = useMemo(
    () => leads.filter(l => l.next_follow_up && l.next_follow_up <= today && l.status !== 'not_interested' && l.status !== 'converted'),
    [leads, today]
  )
  const dueIds = useMemo(() => new Set(dueToday.map(l => l.id)), [dueToday])

  const calledToday = leads.filter(l => l.last_called_at && l.last_called_at.slice(0, 10) === new Date().toISOString().slice(0, 10)).length
  const walkthroughs = leads.filter(l => l.status === 'walkthrough').length
  const remaining = leads.filter(l => l.status === 'new').length

  const visible = useMemo(() => {
    let list: ColdLead[]
    if (tab === 'queue') {
      const queue = leads.filter(l => !['walkthrough', 'converted', 'not_interested'].includes(l.status))
      // Due follow-ups first, then untouched, then by fewest calls
      list = [...queue].sort((a, b) => {
        const aDue = dueIds.has(a.id) ? 0 : 1
        const bDue = dueIds.has(b.id) ? 0 : 1
        if (aDue !== bDue) return aDue - bDue
        if (a.call_count !== b.call_count) return a.call_count - b.call_count
        return a.business_name.localeCompare(b.business_name)
      })
    } else if (tab === 'booked') {
      list = leads.filter(l => l.status === 'walkthrough' || l.status === 'converted')
    } else {
      list = leads
    }
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(l =>
        l.business_name.toLowerCase().includes(q)
        || (l.contact_name || '').toLowerCase().includes(q)
        || (l.suburb || '').toLowerCase().includes(q)
        || (l.phone || '').includes(q)
      )
    }
    return list
  }, [leads, tab, search, dueIds])

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-gray-900">Cold Calls</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {remaining > 0 ? `${remaining} lead${remaining === 1 ? '' : 's'} waiting for a first call` : 'Deck is clear — import more leads'}
          </p>
        </div>
        <button
          onClick={() => setShowImport(true)}
          className="inline-flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-sm font-semibold rounded-xl px-4 py-2.5 shadow-[0_4px_12px_rgba(30,58,95,0.25)] active:scale-[0.98] transition-all flex-shrink-0"
        >
          <Plus className="w-4 h-4" /> Import
        </button>
      </div>

      {/* Scoreboard */}
      <div className="relative overflow-hidden bg-[#0b1320] rounded-2xl p-5">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 90% at 85% -20%, rgba(30,58,95,0.95), transparent 60%)' }} />
        <div className="relative grid grid-cols-3 gap-4">
          <div>
            <p className="text-slate-400 text-[11px] font-semibold uppercase tracking-[0.14em]">Calls today</p>
            <p className="font-display text-3xl font-extrabold text-white tabular-nums mt-1">{calledToday}</p>
          </div>
          <div>
            <p className="text-slate-400 text-[11px] font-semibold uppercase tracking-[0.14em]">Due follow-ups</p>
            <p className={`font-display text-3xl font-extrabold tabular-nums mt-1 ${dueToday.length > 0 ? 'text-amber-400' : 'text-white'}`}>{dueToday.length}</p>
          </div>
          <div>
            <p className="text-slate-400 text-[11px] font-semibold uppercase tracking-[0.14em]">Walk-throughs</p>
            <p className={`font-display text-3xl font-extrabold tabular-nums mt-1 ${walkthroughs > 0 ? 'text-emerald-400' : 'text-white'}`}>{walkthroughs}</p>
          </div>
        </div>
      </div>

      {/* Tabs + search */}
      <div className="flex items-center gap-2 flex-wrap">
        {([
          ['queue', 'Queue'],
          ['booked', 'Booked'],
          ['all', 'All'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`text-xs font-semibold px-3.5 py-2 rounded-xl border transition-colors ${
              tab === key
                ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]'
                : 'bg-white border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-full pl-8 pr-3 py-2 text-[16px] sm:text-sm bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          />
        </div>
      </div>

      {toast && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-medium text-emerald-700">
          {toast}
        </div>
      )}

      {/* Cards */}
      {visible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-14 text-center">
          <Phone className="w-7 h-7 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">
            {leads.length === 0 ? 'No leads yet' : 'Nothing here'}
          </p>
          {leads.length === 0 && (
            <button onClick={() => setShowImport(true)} className="text-xs text-[#1e3a5f] font-semibold hover:underline mt-1">
              Import your first batch →
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(lead => (
            <LeadCard key={lead.id} lead={lead} dueToday={dueIds.has(lead.id)} onChanged={refresh} />
          ))}
        </div>
      )}

      {showImport && (
        <ImportPanel
          onClose={() => setShowImport(false)}
          onDone={msg => { setShowImport(false); setToast(msg); setTimeout(() => setToast(null), 4000); refresh() }}
        />
      )}
    </div>
  )
}
