import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Lead, LeadStatus } from './prospecting'

export const LEAD_COLS = 'id, business_name, contact_name, phone, email, address, suburb, call_count, status, created_at'
const STATUSES: LeadStatus[] = ['new', 'called', 'follow_up', 'walkthrough', 'converted', 'not_interested']

export function toLead(r: any): Lead {
  return {
    id: r.id, company: r.business_name || 'Unnamed business', name: r.contact_name || '', phone: String(r.phone || '').trim(),
    email: String(r.email || '').trim(), address: String(r.address || r.suburb || '').trim(), calls: Number(r.call_count) || 0,
    status: STATUSES.includes(r.status) ? r.status : 'new',
  }
}

/** Every lead, newest first. cold_leads has no RLS policies (server only), so the page checks staff first. */
export async function loadLeads(): Promise<Lead[] | null> {
  const db = createAdminClient() as any
  const { data, error } = await db.from('cold_leads').select(LEAD_COLS).order('created_at', { ascending: false }).order('business_name').limit(5000)
  if (error) return null
  return ((data || []) as any[]).map(toLead)
}
