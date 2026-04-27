'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { sendDocumentEmail } from '@/lib/email'
import type { DocumentContent, DocumentType, DocumentStatus } from '@/types/app'
import type { Json } from '@/types/database'

export async function createDocumentAction(data: {
  client_id: string | null
  document_type: DocumentType
  title: string
  status: DocumentStatus
  content: DocumentContent | Record<string, unknown>
  expiryDate?: string
}): Promise<{ error: string } | { id: string }> {
  const supabase = createClient()

  const { data: doc, error } = await supabase
    .from('documents')
    .insert({
      client_id: data.client_id || null,
      document_type: data.document_type,
      title: data.title,
      status: data.status,
      content: data.content as unknown as Json,
      expires_at: data.expiryDate || null,
      sent_at: data.status === 'sent' ? new Date().toISOString() : null,
    })
    .select('id, ref_number')
    .single()

  if (error) {
    return { error: error.message }
  }

  // Send email if status is 'sent' and client has email (legacy agreements only)
  const legacyContent = data.content as DocumentContent
  if (data.status === 'sent' && legacyContent.clientEmail) {
    await sendDocumentEmail(
      legacyContent.clientEmail,
      legacyContent.clientName,
      data.title,
      doc.id
    )
  }

  revalidatePath('/documents')
  return { id: doc.id }
}

export async function updateDocumentStatusAction(
  id: string,
  status: DocumentStatus
) {
  const supabase = createClient()

  const updates: { status: DocumentStatus; sent_at?: string; signed_at?: string } = { status }
  if (status === 'sent') updates.sent_at = new Date().toISOString()
  if (status === 'signed') updates.signed_at = new Date().toISOString()

  const { error } = await supabase.from('documents').update(updates).eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/documents')
  revalidatePath(`/documents/${id}`)
  return { success: true }
}

export async function createDocumentVersionAction(
  parentId: string,
  data: {
    client_id: string
    document_type: DocumentType
    title: string
    content: DocumentContent
    parentVersion: number
  }
) {
  const supabase = createClient()

  const { data: doc, error } = await supabase
    .from('documents')
    .insert({
      client_id: data.client_id,
      document_type: data.document_type,
      title: data.title,
      status: 'draft',
      content: data.content as unknown as Json,
      parent_id: parentId,
      version: data.parentVersion + 1,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/documents')
  redirect(`/documents/${doc.id}`)
}
