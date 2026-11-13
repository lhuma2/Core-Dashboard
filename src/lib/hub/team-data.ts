import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { abnFmt, auDate, type TeamMember, type SignedDetails } from './team'
import { shortName, currentStatus, cleansPerMonth } from './figures'
import { t12 } from './timetable'
import { dShort } from './home-quotes'

export const PACK_COLS = 'id, token, profile_id, first_name, last_name, email, phone, region, is_team_leader, sent_at, company, abn, contact, contact_phone, insurer, policy, expiry, cert_path, signed_name, signed_at'
const dayAu = (ts: string) => new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Brisbane', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(ts))

export function packDetails(k: any): SignedDetails | null {
  if (!k?.signed_at) return null
  return {
    company: k.company || '', abn: abnFmt(k.abn || ''), contact: k.contact || '', phone: k.contact_phone || k.phone || '', insurer: k.insurer || '', policy: k.policy || '',
    expiry: auDate(String(k.expiry || '').slice(0, 10)), sig: k.signed_name || '', date: dayAu(k.signed_at), cert: !!k.cert_path,
  }
}

/** Everyone on the team, sorted by name: cleaner logins, plus anyone sent the pack who hasn't signed. Null if the hub
 *  can't be reached. Before test-db update 069 there are no packs, so it's just the cleaner logins. */
export async function loadTeam(): Promise<TeamMember[] | null> {
  const db = createClient() as any
  const [pQ, kQ] = await Promise.all([
    db.from('profiles').select('id, full_name, email, phone, region, is_team_leader, pack_signed_at').eq('role', 'cleaner'),
    db.from('cleaner_packs').select(PACK_COLS),
  ])
  if (pQ.error) return null
  const packs: any[] = kQ.error ? [] : kQ.data || []
  const out: TeamMember[] = ((pQ.data || []) as any[]).map(p => {
    const k = packs.find(x => x.profile_id === p.id)
    return {
      kind: 'p', id: p.id, name: String(p.full_name || 'Cleaner').trim(), email: p.email || '', phone: p.phone || '', region: p.region || null,
      leader: !!p.is_team_leader, signed: !!p.pack_signed_at, packId: k?.id || null, details: packDetails(k),
    }
  })
  for (const k of packs) {
    if (k.profile_id) continue
    out.push({ kind: 'k', id: k.id, name: `${k.first_name} ${k.last_name}`.trim(), email: k.email, phone: k.phone || '', region: k.region || null, leader: !!k.is_team_leader, signed: false, packId: k.id, details: null })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

export interface CtClient { id: string; name: string; lines: string[] }
export interface CtRow { id: string; name: string; leader: boolean; signed: boolean; region: string | null; phone: string; clients: CtClient[]; visits: number }

/** Commercial → Team: each cleaner with the commercial clients they're on (mock-up ctAll). */
export async function loadCommercialTeam(today: string): Promise<CtRow[] | null> {
  const db = createClient() as any
  const [team, cQ, sQ, svQ, crQ] = await Promise.all([
    loadTeam(),
    db.from('clients').select('id, business_name, status, resume_on').order('business_name'),
    db.from('client_sites').select('id, client_id, site_name'),
    db.from('client_services').select('id, client_id, site_id, sort_order, days, every, first_clean, start_time, finish_time').order('sort_order'),
    db.from('client_service_cleaners').select('service_id, cleaner_id'),
  ])
  if (!team || cQ.error || sQ.error || svQ.error || crQ.error) return null
  const DAYW: Record<string, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' }
  const ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
  const sites: any[] = sQ.data || [], svcs: any[] = svQ.data || [], crew: any[] = crQ.data || []
  const multi = (cid: string) => sites.filter(s => s.client_id === cid).length > 1
  const nameOf = new Map(team.map(t => [t.id, shortName(t.name)]))
  return team.map(t => {
    let visits = 0
    const clients: CtClient[] = []
    for (const c of (cQ.data || []) as any[]) {
      const st = currentStatus(c, today)
      if (st === 'ended') continue
      const lines: string[] = []
      for (const sv of svcs.filter(s => s.client_id === c.id)) {
        const ids = crew.filter(x => x.service_id === sv.id).map(x => x.cleaner_id)
        if (!ids.includes(t.id)) continue
        const others = ids.filter(i => i !== t.id).map(i => nameOf.get(i)).filter(Boolean)
        const s0 = String(sv.start_time || '').slice(0, 5), f0 = String(sv.finish_time || '').slice(0, 5)
        const time = s0 ? t12(s0) + (f0 ? '–' + t12(f0) : '') : ''
        const days = ORDER.filter(d => (sv.days || []).includes(d)).map(d => DAYW[d]).join(', ') + (sv.every === 'fortnightly' ? ', fortnightly' : sv.every === 'monthly' ? ', monthly' : '')
        const site = multi(c.id) && sv.site_id ? sites.find(s => s.id === sv.site_id)?.site_name || '' : ''
        const first = String(sv.first_clean || '').slice(0, 10)
        let line = [site, days, time].filter(Boolean).join(' · ') + (others.length ? ' · with ' + others.join(', ') : '') + (first && first > today ? ' · starts ' + dShort(first) : '')
        if (st === 'paused') line += ' · paused' + (c.resume_on ? ' until ' + dShort(String(c.resume_on).slice(0, 10)) : '')
        else visits += cleansPerMonth(sv)
        lines.push(line)
      }
      if (lines.length) clients.push({ id: c.id, name: c.business_name || 'Unnamed client', lines })
    }
    return { id: t.id, name: t.name, leader: t.leader, signed: t.signed, region: t.region, phone: t.phone, clients, visits: Math.round(visits) }
  })
}
