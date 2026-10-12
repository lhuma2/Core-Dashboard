'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireStaff } from '@/lib/require-staff'

export async function addCompanyDocumentAction(name: string, fileUrl: string, kind: 'document' | 'sop' = 'document') {
  const denied = await requireStaff()
  if (denied) return { error: denied }
  if (!name || !fileUrl) return { error: 'Missing file details' }
  const db = createAdminClient() as any
  const { error } = await db.from('company_documents').insert({ name, file_url: fileUrl, kind })
  if (error) return { error: error.message }
  revalidatePath('/documents'); revalidatePath('/sops')
  return { success: true }
}

export async function deleteCompanyDocumentAction(id: string) {
  const denied = await requireStaff()
  if (denied) return { error: denied }
  const db = createAdminClient() as any
  const { error } = await db.from('company_documents').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/documents'); revalidatePath('/sops')
  return { success: true }
}
