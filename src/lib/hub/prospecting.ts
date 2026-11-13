// Commercial → Prospecting: the cold-call list (table cold_leads). Words from the mock-up.

export type LeadStatus = 'new' | 'called' | 'follow_up' | 'walkthrough' | 'converted' | 'not_interested'
export interface Lead {
  id: string; company: string; name: string; phone: string; email: string; address: string
  calls: number; status: LeadStatus
}
export type LeadF = 'all' | 'new' | 'follow_up' | 'walkthrough'
export const LEAD_CHIPS: [LeadF, string][] = [['all', 'All'], ['new', 'To call'], ['follow_up', 'Follow-up'], ['walkthrough', 'Walk-through']]

/** To call covers leads not reached yet (new) and ones called with no answer (the old hub's "called"). */
export const inLeadF = (l: Lead, f: LeadF) => f === 'all' || (f === 'new' ? l.status === 'new' || l.status === 'called' : l.status === f)
export function leadTag(s: LeadStatus): [string, string] {
  if (s === 'follow_up') return ['Follow-up', 'tag fu']
  if (s === 'walkthrough') return ['Walk-through', 'tag wt']
  if (s === 'converted') return ['Client', 'tag wt']
  if (s === 'not_interested') return ['Not interested', 'tag draft']
  return ['', '']
}

// ── CSV import (moved from the old hub's cold-call import, columns found by their header) ──

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], field = '', inQuotes = false
  const t = text.replace(/^﻿/, '')
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]
    if (inQuotes) {
      if (ch === '"') { if (t[i + 1] === '"') { field += '"'; i++ } else inQuotes = false } else field += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some(f => f.trim() !== '')) rows.push(row)
      row = []
    } else field += ch
  }
  row.push(field)
  if (row.some(f => f.trim() !== '')) rows.push(row)
  return rows
}

export interface LeadCols { business: number; contact: number; phone: number; email: number; address: number; suburb: number; industry: number; website: number }
export function guessLeadCols(raw: string[]): LeadCols {
  const h = raw.map(x => x.trim().toLowerCase())
  const find = (ok: (s: string) => boolean) => h.findIndex(ok)
  const has = (s: string, ...subs: string[]) => subs.some(x => s.includes(x))
  let business = find(s => has(s, 'business', 'company', 'organisation', 'organization', 'trading name') && !has(s, 'address', 'email', 'phone', 'website'))
  if (business === -1) business = find(s => s === 'name')
  return {
    business,
    contact: find(s => has(s, 'contact', 'owner', 'full name', 'first name', 'person', 'director', 'manager') && !has(s, 'email', 'phone', 'number', 'mobile')),
    phone: find(s => has(s, 'phone', 'mobile', 'tel') || s === 'number'),
    email: find(s => has(s, 'email', 'e-mail')),
    address: find(s => has(s, 'address', 'street') && !has(s, 'email', 'web')),
    suburb: find(s => has(s, 'suburb', 'city', 'locality')),
    industry: find(s => has(s, 'industry', 'category', 'sector', 'niche')),
    website: find(s => has(s, 'website', 'url', 'domain')),
  }
}
/** Same business name and phone digits = the same lead. */
export const leadKey = (business: string, phone: string) => business.trim().toLowerCase().replace(/\s+/g, ' ') + '::' + String(phone || '').replace(/[^0-9]/g, '')
