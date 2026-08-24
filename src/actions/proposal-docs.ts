'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_PROPOSAL, withProposalDefaults, type ProposalData } from '@/lib/documents/proposal'
import { mapProposalToAgreement, withAgreementDefaults } from '@/lib/documents/agreement'
import { flattenCompanyDocument } from '@/lib/documents/flatten'

export type DocKind = 'proposal' | 'agreement' | 'one_off' | 'capability'

export interface ProposalDoc {
  id: string
  kind: DocKind
  status: string
  ref_number: string | null
  client_name: string | null
  data: any
  source_id: string | null
  client_id: string | null
  lead_id: string | null
  pdf_url: string | null
  signed_pdf_url: string | null
  docusign_envelope_id: string | null
  sent_at: string | null
  created_at: string
  updated_at: string
}

function nextRef(prefix: string): string {
  // e.g. DC-PROP-4821 — short, human, unique enough for display
  return `${prefix}-${Math.floor(1000 + Math.random() * 8999)}`
}

// ─── Create ──────────────────────────────────────────────────────────────────

export async function createProposalAction(seed?: Partial<ProposalData> & { clientId?: string }) {
  const db = createAdminClient() as any
  const ref = nextRef('DC-PROP')
  const data: ProposalData = { ...DEFAULT_PROPOSAL, ...(seed ?? {}), refNumber: ref }

  const { data: row, error } = await db.from('proposal_documents').insert({
    kind: 'proposal',
    status: 'draft',
    ref_number: ref,
    client_name: data.clientName,
    client_id: seed?.clientId ?? null,
    data,
  }).select('id').single()

  if (error) return { error: error.message }
  revalidatePath('/documents')
  redirect(`/documents/${row.id}`)
}

// ─── Create from a selected company document (embeds that PDF as the proposal) ─

export async function createProposalFromDocAction(name: string, fileUrl: string, clientName?: string) {
  const db = createAdminClient() as any
  const ref = nextRef('DC-PROP')
  const data: ProposalData = { ...DEFAULT_PROPOSAL, clientName: clientName || name, refNumber: ref }

  const { data: row, error } = await db.from('proposal_documents').insert({
    kind: 'proposal',
    status: 'draft',
    ref_number: ref,
    client_name: data.clientName,
    pdf_url: fileUrl,   // the selected company document shown in the preview
    data,
  }).select('id').single()

  if (error) return { error: error.message }
  revalidatePath('/documents')
  redirect(`/documents/${row.id}`)
}

// ─── Save (with optional version snapshot) ───────────────────────────────────

export async function saveProposalDocAction(id: string, data: ProposalData, snapshotLabel?: string) {
  const db = createAdminClient() as any
  const { error } = await db.from('proposal_documents').update({
    data,
    client_name: data.clientName,
    ref_number: data.refNumber,
  }).eq('id', id)
  if (error) return { error: error.message }

  if (snapshotLabel) {
    await db.from('proposal_document_versions').insert({ document_id: id, data, label: snapshotLabel })
  }
  revalidatePath('/documents')
  revalidatePath(`/documents/${id}`)
  return { success: true }
}

// ─── Bake the filled-in fields into the PDF and save that copy on the document ─
// Runs alongside the browser's download (see the flatten API route) so the
// filled-in version is persisted here, not just streamed to the browser.

export async function saveFlattenedPdfAction(id: string) {
  const db = createAdminClient() as any
  const { data: doc } = await db.from('proposal_documents').select('id, pdf_url, client_name, data').eq('id', id).single()
  if (!doc) return { error: 'Document not found' }
  if (!doc.pdf_url) return { error: 'This document has no PDF attached.' }

  const sourceRes = await fetch(doc.pdf_url)
  if (!sourceRes.ok) return { error: 'Could not load the original PDF.' }
  const sourceBytes = new Uint8Array(await sourceRes.arrayBuffer())

  let flattened: Uint8Array
  try {
    flattened = await flattenCompanyDocument(sourceBytes, doc.data?.placements ?? [], doc.data?.fieldValues ?? {})
  } catch (e: any) {
    return { error: `Could not generate the PDF: ${e?.message ?? 'unknown error'}` }
  }

  const safe = (s: string) => s.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `proposal-pdfs/${id}-${Date.now()}-${safe(doc.client_name || 'document')}.pdf`
  const { error: upErr } = await db.storage.from('job-photos')
    .upload(path, Buffer.from(flattened), { contentType: 'application/pdf', upsert: false })
  if (upErr) return { error: upErr.message }

  const { data: pub } = db.storage.from('job-photos').getPublicUrl(path)
  const { error: dbErr } = await db.from('proposal_documents').update({ signed_pdf_url: pub.publicUrl }).eq('id', id)
  if (dbErr) return { error: dbErr.message }

  revalidatePath('/documents')
  revalidatePath(`/documents/${id}`)
  return { success: true, url: pub.publicUrl }
}

// ─── Convert accepted proposal → agreement (prefilled, editable) ─────────────

export async function convertToAgreementAction(proposalId: string) {
  const db = createAdminClient() as any
  const { data: proposal } = await db.from('proposal_documents').select('*').eq('id', proposalId).single()
  if (!proposal) return { error: 'Proposal not found' }

  // If an agreement already exists for this proposal, just open it
  const { data: existing } = await db.from('proposal_documents').select('id').eq('source_id', proposalId).eq('kind', 'agreement').maybeSingle()
  if (existing?.id) {
    redirect(`/documents/${existing.id}`)
  }

  const agreementRef = (proposal.ref_number || nextRef('DC-PROP')).replace(/^DC-PROP/, 'DCA')
  const data = mapProposalToAgreement(withProposalDefaults(proposal.data), agreementRef)

  const { data: row, error } = await db.from('proposal_documents').insert({
    kind: 'agreement',
    status: 'draft',
    ref_number: agreementRef,
    client_name: data.clientName,
    client_id: proposal.client_id,
    lead_id: proposal.lead_id,
    source_id: proposalId,
    data,
  }).select('id').single()
  if (error) return { error: error.message }

  // Mark the proposal accepted now that it's progressing to contract
  await db.from('proposal_documents').update({ status: 'accepted' }).eq('id', proposalId)

  revalidatePath('/documents')
  redirect(`/documents/${row.id}`)
}

// Create an agreement already linked to a client, prefilled with the client's
// name + details — so a signed contract lands on their profile and never carries
// the "Northpoint Commercial" placeholder title.
export async function createAgreementForClientAction(clientId: string) {
  const db = createAdminClient() as any
  const { data: client } = await db.from('clients').select('*').eq('id', clientId).single()
  if (!client) return { error: 'Client not found' }

  const ref = nextRef('DCA')
  const monthly = client.monthly_value ? `$${Number(client.monthly_value).toLocaleString('en-AU')} / month` : ''
  const premises = client.address
    ? [client.address, client.suburb, client.state, client.postcode].filter(Boolean).join(', ')
    : 'Multiple sites — see Schedule 1'
  const commencement = client.start_date
    ? new Date(String(client.start_date) + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
    : ''

  const data = withAgreementDefaults({
    clientName: client.business_name,
    premises,
    serviceFee: monthly,
    commencementDate: commencement,
    agreementRef: ref,
    contactName: client.contact_name || undefined,
    contactEmail: client.contact_email || undefined,
    contactPhone: client.contact_phone || undefined,
  })

  const { data: row, error } = await db.from('proposal_documents').insert({
    kind: 'agreement', status: 'draft', ref_number: ref,
    client_name: client.business_name, client_id: clientId, data,
  }).select('id').single()
  if (error) return { error: error.message }

  revalidatePath('/documents')
  redirect(`/documents/${row.id}`)
}

export async function saveAgreementDocAction(id: string, data: any, snapshotLabel?: string) {
  const db = createAdminClient() as any
  const { error } = await db.from('proposal_documents').update({
    data, client_name: data.clientName, ref_number: data.agreementRef,
  }).eq('id', id)
  if (error) return { error: error.message }
  if (snapshotLabel) await db.from('proposal_document_versions').insert({ document_id: id, data, label: snapshotLabel })
  revalidatePath('/documents'); revalidatePath(`/documents/${id}`)
  return { success: true }
}

export async function setDocStatusAction(id: string, status: string) {
  const db = createAdminClient() as any
  const { error } = await db.from('proposal_documents').update({ status }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/documents')
  revalidatePath(`/documents/${id}`)
  return { success: true }
}

// Link a document to a client so a signed agreement lands on that client's profile.
export async function setDocClientAction(id: string, clientId: string | null) {
  const db = createAdminClient() as any
  const { error } = await db.from('proposal_documents').update({ client_id: clientId || null }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/documents')
  revalidatePath(`/documents/${id}`)
  return { success: true }
}

// ─── Duplicate / delete ──────────────────────────────────────────────────────

export async function duplicateProposalDocAction(id: string) {
  const db = createAdminClient() as any
  const { data: orig } = await db.from('proposal_documents').select('*').eq('id', id).single()
  if (!orig) return { error: 'Document not found' }
  const ref = nextRef(orig.kind === 'proposal' ? 'DC-PROP' : 'DC-DOC')
  const data = { ...(orig.data ?? {}), refNumber: ref }
  const { error } = await db.from('proposal_documents').insert({
    kind: orig.kind, status: 'draft', ref_number: ref,
    client_name: orig.client_name, client_id: orig.client_id, data,
  })
  if (error) return { error: error.message }
  revalidatePath('/documents')
  return { success: true }
}

export async function deleteProposalDocAction(id: string) {
  const db = createAdminClient() as any
  const { error } = await db.from('proposal_documents').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/documents')
  return { success: true }
}

// ─── Restore a prior version ─────────────────────────────────────────────────

export async function restoreVersionAction(documentId: string, versionId: string) {
  const db = createAdminClient() as any
  const { data: v } = await db.from('proposal_document_versions').select('data').eq('id', versionId).single()
  if (!v) return { error: 'Version not found' }
  await db.from('proposal_documents').update({
    data: v.data, client_name: v.data?.clientName, ref_number: v.data?.refNumber,
  }).eq('id', documentId)
  revalidatePath(`/documents/${documentId}`)
  return { success: true }
}
