'use client'

import { useState } from 'react'
import { Search, Mail, Phone, Building2, MapPin, Linkedin, X, AlertTriangle, Loader2, UserCheck } from 'lucide-react'
import { searchProspectsAction, saveProspectAction, dismissProspectAction } from '@/actions/prospecting'
import { ROLE_GROUPS } from '@/lib/prospecting/types'
import type { Prospect, ProspectCandidate, ProspectSource } from '@/lib/prospecting/types'

const SOURCE_META: Record<ProspectSource, { label: string; chip: string; note: string }> = {
  apollo: { label: 'Apollo', chip: 'bg-indigo-50 text-indigo-700 border-indigo-100', note: 'Search is free — credits only spend when you save a contact.' },
  lusha:  { label: 'Lusha',  chip: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100', note: 'Lusha charges credits per result shown, not just on save.' },
}

function CandidateCard({ candidate, onSave, saving }: { candidate: ProspectCandidate; onSave: (c: ProspectCandidate) => void; saving: boolean }) {
  const source = SOURCE_META[candidate.source]
  return (
    <div className="bg-white border border-gray-200/70 rounded-xl p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border ${source.chip}`}>{source.label}</span>
            {candidate.linkedin_url && (
              <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-600">
                <Linkedin className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
          <p className="text-sm font-semibold text-gray-900 truncate">{candidate.contact_name || 'Unnamed contact'}</p>
          <p className="text-xs text-gray-500 truncate">{candidate.job_title || '—'}</p>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
            {candidate.company_name && <span className="inline-flex items-center gap-1"><Building2 className="w-3 h-3" />{candidate.company_name}</span>}
            {candidate.location && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{candidate.location}</span>}
          </div>
        </div>
        <button
          onClick={() => onSave(candidate)}
          disabled={saving || (!candidate.can_reveal_email && !candidate.can_reveal_phone)}
          title="Reveal contact details and save"
          className="flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-medium bg-[#00250e] hover:bg-[#003314] text-white rounded-lg px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
          Reveal &amp; save
        </button>
      </div>
    </div>
  )
}

function SavedProspectCard({ prospect, onDismiss, pending }: { prospect: Prospect; onDismiss: (id: string) => void; pending: boolean }) {
  const source = SOURCE_META[prospect.source]
  const phoneHref = prospect.phone ? `tel:${prospect.phone.replace(/[^\d+]/g, '')}` : undefined
  return (
    <div className="bg-white border border-gray-200/70 rounded-xl p-3.5 relative">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border ${source.chip}`}>{source.label}</span>
          </div>
          <p className="text-sm font-semibold text-gray-900 truncate">{prospect.contact_name || 'Unnamed contact'}</p>
          <p className="text-xs text-gray-500 truncate">{prospect.job_title || '—'}{prospect.company_name ? ` · ${prospect.company_name}` : ''}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs">
            {prospect.phone && <a href={phoneHref} className="inline-flex items-center gap-1 text-gray-700 hover:text-[#00250e]"><Phone className="w-3 h-3 text-gray-400" />{prospect.phone}</a>}
            {prospect.email && <a href={`mailto:${prospect.email}`} className="inline-flex items-center gap-1 text-gray-700 hover:text-[#00250e]"><Mail className="w-3 h-3 text-gray-400" />{prospect.email}</a>}
            {!prospect.phone && !prospect.email && <span className="text-gray-400">No contact details revealed</span>}
          </div>
        </div>
        <button
          onClick={() => onDismiss(prospect.id)}
          disabled={pending}
          title="Dismiss — not relevant"
          className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg border border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-200 transition-colors disabled:opacity-40"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

export function ProspectingBoard({ initialProspects, connected }: { initialProspects: Prospect[]; connected: { apollo: boolean; lusha: boolean } }) {
  const [source, setSource] = useState<ProspectSource>(connected.apollo ? 'apollo' : 'lusha')
  const [roleKeys, setRoleKeys] = useState<string[]>(ROLE_GROUPS.map((r) => r.key))
  const [candidates, setCandidates] = useState<ProspectCandidate[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [prospects, setProspects] = useState(initialProspects)
  const [dismissingId, setDismissingId] = useState<string | null>(null)

  const anyConnected = connected.apollo || connected.lusha

  function toggleRole(key: string) {
    setRoleKeys((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key])
  }

  async function handleSearch() {
    setSearching(true)
    setSearchError(null)
    setCandidates([])
    const result = await searchProspectsAction(source, roleKeys)
    if (result.error) setSearchError(result.error)
    else setCandidates(result.candidates ?? [])
    setSearching(false)
  }

  async function handleSave(candidate: ProspectCandidate) {
    setSavingId(candidate.external_id)
    const result = await saveProspectAction(candidate)
    if (!result.error) {
      setCandidates((prev) => prev.filter((c) => c.external_id !== candidate.external_id))
      // Refresh saved list from server state isn't wired here — a full reload keeps it simple and correct.
      window.location.reload()
    }
    setSavingId(null)
  }

  async function handleDismiss(id: string) {
    setDismissingId(id)
    setProspects((prev) => prev.filter((p) => p.id !== id))
    await dismissProspectAction(id)
    setDismissingId(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Prospecting</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          {prospects.length} saved · Apollo &amp; Lusha · North Brisbane–Gold Coast · commercial cleaning decision-makers
        </p>
      </div>

      {!anyConnected && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl p-4">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-medium">Neither provider is connected yet</p>
            <p className="text-amber-700 mt-0.5">Add <code className="font-mono text-xs">APOLLO_API_KEY</code> and/or <code className="font-mono text-xs">LUSHA_API_KEY</code> to the environment once you've signed up, then this page goes live — nothing else needs to change.</p>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-4 space-y-4">
        <div className="flex items-center gap-2">
          {(['apollo', 'lusha'] as ProspectSource[]).map((s) => (
            <button
              key={s}
              onClick={() => setSource(s)}
              disabled={!connected[s]}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                source === s && connected[s] ? 'bg-[#00250e] text-white border-[#00250e]' : 'border-gray-200 text-gray-500 hover:text-gray-900'
              }`}
            >
              {SOURCE_META[s].label}{!connected[s] ? ' (not connected)' : ''}
            </button>
          ))}
          <span className="text-xs text-gray-400 ml-1">{SOURCE_META[source].note}</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {ROLE_GROUPS.map((role) => (
            <button
              key={role.key}
              onClick={() => toggleRole(role.key)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                roleKeys.includes(role.key) ? 'bg-[#00250e]/5 border-[#00250e]/30 text-[#00250e] font-medium' : 'border-gray-200 text-gray-400 hover:text-gray-700'
              }`}
            >
              {role.label}
            </button>
          ))}
        </div>

        <button
          onClick={handleSearch}
          disabled={searching || !connected[source] || roleKeys.length === 0}
          className="inline-flex items-center gap-2 text-sm font-medium bg-[#003314] hover:bg-[#00250e] text-white rounded-lg px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {searching ? 'Searching…' : 'Search'}
        </button>

        {searchError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{searchError}</p>
        )}

        {candidates.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 pt-2 border-t border-gray-100">
            {candidates.map((c) => (
              <CandidateCard key={c.external_id} candidate={c} onSave={handleSave} saving={savingId === c.external_id} />
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Saved prospects</h3>
        {prospects.length === 0 ? (
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl py-10 text-center">
            <p className="text-sm text-gray-400">No saved prospects yet — search above and reveal &amp; save the ones worth calling.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {prospects.map((p) => (
              <SavedProspectCard key={p.id} prospect={p} onDismiss={handleDismiss} pending={dismissingId === p.id} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
