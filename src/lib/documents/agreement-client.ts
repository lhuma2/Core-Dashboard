// Turning a signed service agreement into a client profile (server-only).
// Used when the client signs, and from the Clients tab prompt when that
// automatic step couldn't run.

import { createAdminClient } from '@/lib/supabase/admin'
import { withAgreementDefaults } from './agreement'

// Best-effort parsers for agreement particulars → client fields.
export function parseMonthlyFee(s?: string): number | null {
  if (!s) return null
  const n = parseFloat(String(s).replace(/,/g, '').replace(/[^0-9.]/g, ''))
  if (isNaN(n)) return null
  const l = s.toLowerCase()
  if (/fortnight/.test(l)) return Math.round((n * 26 / 12) * 100) / 100
  if (/week/.test(l)) return Math.round((n * 52 / 12) * 100) / 100
  if (/visit|clean|service\b|hour|year|annum/.test(l)) return null
  return n
}

export function parseDateLoose(s?: string): string | null {
  const v = (s ?? '').trim()
  if (!v) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0]
}

export function parseAddress(premises?: string): { address: string | null; suburb: string | null; state: string | null; postcode: string | null } {
  const p = (premises ?? '').trim()
  if (!p || /multiple sites/i.test(p)) return { address: null, suburb: null, state: null, postcode: null }
  const m = p.match(/^(.*?),\s*([A-Za-z .'-]+?)\s+(QLD|NSW|VIC|SA|WA|TAS|NT|ACT)\s+(\d{4})\s*$/i)
  if (m) return { address: m[1].trim(), suburb: m[2].trim(), state: m[3].toUpperCase(), postcode: m[4] }
  const m2 = p.match(/^(.*?)\s+(QLD|NSW|VIC|SA|WA|TAS|NT|ACT)\s+(\d{4})\s*$/i)
  if (m2) return { address: m2[1].trim(), suburb: null, state: m2[2].toUpperCase(), postcode: m2[3] }
  return { address: p, suburb: null, state: null, postcode: null }
}

export interface SignedAgreementRow {
  id: string
  client_id: string | null
  signer_email: string | null
  signed_name: string | null
  data: any
  onboarding?: any
}

/**
 * Link a signed agreement to a commercial client: an existing client of the same
 * name (filling only the fields it's missing), or a new profile built from the
 * agreement and flagged for the owner to review. Returns the client id.
 */
export async function linkOrCreateClient(db: any, doc: SignedAgreementRow): Promise<{ clientId: string | null; created: boolean; error?: string }> {
  if (doc.client_id) return { clientId: doc.client_id, created: false }
  const agreement = withAgreementDefaults(doc.data)
  const d = doc.onboarding ?? {}

  const { data: existing } = await db.from('clients')
    .select('id, abn, billing_email, po_number, site_contact_name, site_contact_phone')
    .ilike('business_name', agreement.clientName).limit(1).maybeSingle()

  let clientId: string | null = null
  let created = false
  if (existing?.id) {
    clientId = existing.id
    await db.from('clients').update({
      abn:                existing.abn                ?? d.abn ?? null,
      billing_email:      existing.billing_email      ?? d.billingEmail ?? null,
      po_number:          existing.po_number          ?? d.poNumber ?? null,
      site_contact_name:  existing.site_contact_name  ?? d.siteContactName ?? null,
      site_contact_phone: existing.site_contact_phone ?? d.siteContactPhone ?? null,
    }).eq('id', clientId)
  } else {
    const addr = parseAddress(agreement.premises)
    const monthly = parseMonthlyFee(agreement.serviceFee)
    const { data: newClient, error } = await db.from('clients').insert({
      business_name: agreement.clientName,
      address: addr.address, suburb: addr.suburb, state: addr.state, postcode: addr.postcode,
      contact_name: doc.signed_name || null, contact_email: doc.signer_email || null,
      monthly_value: monthly,
      annual_value: monthly != null ? Math.round(monthly * 12 * 100) / 100 : null,
      start_date: doc.data?.commencementDateIso || parseDateLoose(agreement.commencementDate),
      abn: d.abn ?? null, billing_email: d.billingEmail ?? null, po_number: d.poNumber ?? null,
      site_contact_name: d.siteContactName ?? null, site_contact_phone: d.siteContactPhone ?? null,
      notes: d.notes ?? null,
      active: true, is_multi_site: false, service_type: [],
      needs_review: true,
    }).select('id').single()
    if (error) return { clientId: null, created: false, error: error.message }
    clientId = newClient?.id ?? null
    created = !!clientId
  }
  if (clientId) await db.from('proposal_documents').update({ client_id: clientId }).eq('id', doc.id)
  return { clientId, created }
}

/** The client-portal login linked to a client, if one has been set up. */
export async function portalLoginFor(db: any, clientId: string): Promise<{ email: string; name: string | null } | null> {
  const { data } = await db.from('profiles')
    .select('email, full_name').eq('linked_client_id', clientId).eq('role', 'client')
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  return data?.email ? { email: data.email, name: data.full_name ?? null } : null
}

/** A signed residential / end-of-lease agreement has been added on the Clients tab. */
export async function markAgreementClientAdded(docId: FormDataEntryValue | null): Promise<void> {
  const id = typeof docId === 'string' ? docId.trim() : ''
  if (!/^[0-9a-f-]{36}$/i.test(id)) return
  await (createAdminClient() as any).from('proposal_documents')
    .update({ client_added_at: new Date().toISOString() }).eq('id', id).eq('kind', 'agreement')
}

/** Prefill for the residential / bond "add" forms from a signed agreement. */
export async function jobPrefillFromAgreement(docId?: string) {
  if (!docId || !/^[0-9a-f-]{36}$/i.test(docId)) return undefined
  const { data: doc } = await (createAdminClient() as any).from('proposal_documents')
    .select('id, kind, status, data, onboarding').eq('id', docId).maybeSingle()
  if (!doc || doc.kind !== 'agreement' || doc.status !== 'signed') return undefined
  const a = withAgreementDefaults(doc.data)
  const o = doc.onboarding ?? {}
  const comments = [
    a.frequency && `Frequency: ${a.frequency}`,
    a.serviceFee && `Fee: ${a.serviceFee}`,
    o.siteContactName && `Site contact: ${o.siteContactName}`,
    o.notes,
  ].filter(Boolean).join('\n')
  return {
    fromDoc: doc.id as string,
    client_name: a.clientName,
    address: a.premises,
    contact_phone: o.siteContactPhone || undefined,
    clean_date: doc.data?.commencementDateIso || parseDateLoose(a.commencementDate) || undefined,
    comments: comments || undefined,
  }
}
