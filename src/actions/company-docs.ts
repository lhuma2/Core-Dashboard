'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export async function addCompanyDocumentAction(name: string, fileUrl: string) {
  if (!name || !fileUrl) return { error: 'Missing file details' }
  const db = createAdminClient() as any
  const { error } = await db.from('company_documents').insert({ name, file_url: fileUrl })
  if (error) return { error: error.message }
  revalidatePath('/documents')
  return { success: true }
}

export async function deleteCompanyDocumentAction(id: string) {
  const db = createAdminClient() as any
  const { error } = await db.from('company_documents').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/documents')
  return { success: true }
}
