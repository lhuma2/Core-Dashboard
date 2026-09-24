'use client'

import { useState, useTransition } from 'react'
import { Check, ExternalLink, Mail, Phone, MapPin, Building2, CalendarClock, RefreshCw, FileSearch } from 'lucide-react'
import { tickOffTenderAction, refreshTendersAction } from '@/actions/tenders'
import { formatDate } from '@/lib/formatters'
import type { Tender } from '@/lib/tenders/types'

const SOURCE_META: Record<Tender['source'], { label: string; chip: string }> = {
  austender: { label: 'AusTender', chip: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
  qtenders:  { label: 'QTenders',  chip: 'bg-sky-50 text-sky-700 border-sky-100' },
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const close = new Date(dateStr + 'T00:00:00')
  return Math.ceil((close.getTime() - Date.now()) / 86_400_000)
}

function closeLabel(dateStr: string | null): { text: string; urgent: boolean } {
  const days = daysUntil(dateStr)
  if (days == null) return { text: 'No close date', urgent: false }
  if (days < 0) return { text: 'Closed', urgent: true }
  if (days === 0) return { text: 'Closes today', urgent: true }
  if (days === 1) return { text: 'Closes tomorrow', urgent: true }
  return { text: `Closes in ${days}d`, urgent: days <= 5 }
}

function Detail({ icon: Icon, children, href }: { icon: React.ElementType; children: React.ReactNode; href?: string }) {
  const body = (
    <span className={`inline-flex items-center gap-1.5 text-[13px] text-gray-700 ${href ? 'hover:text-[#00250e]' : ''}`}>
      <Icon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
      <span className="truncate">{children}</span>
    </span>
  )
  return href ? <a href={href} className="min-w-0">{body}</a> : <span className="min-w-0">{body}</span>
}

function TenderCard({ tender, onTickOff, pending }: { tender: Tender; onTickOff: (id: string) => void; pending: boolean }) {
  const source = SOURCE_META[tender.source]
  const close = closeLabel(tender.close_date)
  const phoneHref = tender.contact_phone ? `tel:${tender.contact_phone.replace(/[^\d+]/g, '')}` : undefined

  return (
    <div className="bg-white border border-gray-200/70 shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:shadow-[0_4px_16px_rgba(16,24,40,0.08)] transition-all duration-200 rounded-2xl p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[3px] bg-[#00250e]/15" />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border ${source.chip}`}>
              {source.label}
            </span>
            {tender.category && (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-gray-100 text-gray-500 border border-gray-200 truncate max-w-[220px]">
                {tender.category}
              </span>
            )}
            {tender.notice_type === 'pipeline' ? (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-100">
                Pipeline · not open yet
              </span>
            ) : (
              <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${close.urgent ? 'text-red-600' : 'text-gray-400'}`}>
                <CalendarClock className="w-3 h-3" /> {close.text}
              </span>
            )}
          </div>
          <a href={tender.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-gray-900 hover:text-blue-600 transition-colors leading-snug">
            {tender.title}
          </a>
        </div>
        <button
          onClick={() => onTickOff(tender.id)}
          disabled={pending}
          title="Tick off — remove and replace with the next tender"
          className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 text-gray-400 hover:text-white hover:bg-[#00250e] hover:border-[#00250e] transition-colors disabled:opacity-40"
        >
          <Check className="w-4 h-4" />
        </button>
      </div>

      {tender.summary && (
        <p className="text-[13px] text-gray-500 mt-2.5 leading-relaxed line-clamp-3">{tender.summary}</p>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-gray-100">
        {tender.issuer && <Detail icon={Building2}>{tender.issuer}</Detail>}
        {tender.location && <Detail icon={MapPin}>{tender.location}</Detail>}
        {tender.contact_phone && <Detail icon={Phone} href={phoneHref}>{tender.contact_phone}</Detail>}
        {tender.contact_email && <Detail icon={Mail} href={`mailto:${tender.contact_email}`}>{tender.contact_email}</Detail>}
      </div>

      <div className="flex items-center justify-between mt-3">
        <span className="text-[11px] text-gray-400">
          {tender.open_date ? `Opened ${formatDate(tender.open_date)}` : ''}
          {tender.close_date ? ` · Closes ${formatDate(tender.close_date)}` : ''}
        </span>
        <a href={tender.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:text-blue-700 inline-flex items-center gap-1">
          View listing <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  )
}

export function TenderBoard({ initialTenders }: { initialTenders: Tender[] }) {
  const [tenders, setTenders] = useState(initialTenders)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [isRefreshing, startRefresh] = useTransition()

  async function handleTickOff(id: string) {
    setPendingId(id)
    setTenders((prev) => prev.filter((t) => t.id !== id))
    const result = await tickOffTenderAction(id)
    if (result?.error) {
      // restore on failure
      setTenders(initialTenders)
    }
    setPendingId(null)
  }

  function handleRefresh() {
    startRefresh(async () => {
      await refreshTendersAction()
      window.location.reload()
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Tenders</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {tenders.length} of 10 · AusTender &amp; QTenders · cleaning &amp; pressure washing · North Brisbane–Gold Coast
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 text-xs font-medium text-gray-500 hover:text-gray-900 border border-gray-200 rounded-lg px-3 py-2 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing…' : 'Refresh now'}
        </button>
      </div>

      {tenders.length === 0 ? (
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl py-12 text-center">
          <FileSearch className="w-8 h-8 text-gray-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">No tenders loaded yet</p>
          <button onClick={handleRefresh} className="text-xs text-blue-600 hover:underline mt-1">
            Fetch tenders now →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {tenders.map((tender) => (
            <TenderCard key={tender.id} tender={tender} onTickOff={handleTickOff} pending={pendingId === tender.id} />
          ))}
        </div>
      )}
    </div>
  )
}
