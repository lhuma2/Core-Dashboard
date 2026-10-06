'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasTemplate, type DocTemplate, type TemplateDocData } from '@/lib/documents/template'

const NON_STAFF = ['cleaner', 'client', 'manager']

async function requireStaff(): Promise<string | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 'Please sign in again.'
  const role = (user.user_metadata?.role as string) ?? 'admin'
  return NON_STAFF.includes(role) ? 'Not allowed.' : null
}

function nextRef(prefix: string): string {
  return `${prefix}-${Math.floor(1000 + Math.random() * 8999)}`
}

const MISSING_COLUMN = /column .*template.* does not exist|could not find the 'template' column/i

// ─── Template setup (on a company document) ──────────────────────────────────

export async function saveCompanyDocTemplateAction(companyDocId: string, template: DocTemplate | null) {
  const denied = await requireStaff()
  if (denied) return { error: denied }
  const db = createAdminClient() as any
  const { error } = await db.from('company_documents')
    .update({ template: template && template.fields.length ? template : null })
    .eq('id', companyDocId)
  if (error) {
    if (MISSING_COLUMN.test(error.message)) return { error: 'The database needs migration 054_company_docs_template.sql before templates can be saved.' }
    return { error: error.message }
  }
  revalidatePath('/documents')
  revalidatePath(`/documents/templates/${companyDocId}`)
  return { success: true }
}

// ─── New proposal from a template ────────────────────────────────────────────

export async function createProposalFromTemplateAction(companyDocId: string) {
  const denied = await requireStaff()
  if (denied) return { error: denied }
  const db = createAdminClient() as any
  const { data: cd } = await db.from('company_documents').select('*').eq('id', companyDocId).single()
  if (!cd) return { error: 'Template not found.' }
  if (!hasTemplate(cd.template)) return { error: 'This document has no template fields set up yet.' }

  const ref = nextRef('DC-PROP')
  const data: TemplateDocData = {
    clientName: cd.name,
    refNumber: ref,
    templateId: cd.id,
    templateName: cd.name,
    template: cd.template,
    values: {},
  }
  const { data: row, error } = await db.from('proposal_documents').insert({
    kind: 'proposal',
    status: 'draft',
    ref_number: ref,
    client_name: cd.name,
    pdf_url: cd.file_url,
    data,
  }).select('id').single()
  if (error) return { error: error.message }
  revalidatePath('/documents')
  redirect(`/documents/${row.id}`)
}

// ─── Autosave from the text-box editor ───────────────────────────────────────

export async function saveTemplateDocAction(id: string, patch: { clientName: string; values: Record<string, string>; clientType?: TemplateDocData['clientType'] }) {
  const denied = await requireStaff()
  if (denied) return { error: denied }
  const db = createAdminClient() as any
  const { data: doc } = await db.from('proposal_documents').select('data').eq('id', id).single()
  if (!doc) return { error: 'Document not found.' }
  const data = { ...(doc.data ?? {}), clientName: patch.clientName, values: patch.values, ...(patch.clientType ? { clientType: patch.clientType } : {}) }
  const { error } = await db.from('proposal_documents')
    .update({ data, client_name: patch.clientName || doc.data?.templateName || 'Untitled' })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/documents')
  return { success: true }
}
