'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { financialRecordSchema } from '@/lib/validations/financial.schema'

export async function createFinancialRecordAction(formData: FormData) {
  const supabase = createClient()

  const raw = {
    client_id: formData.get('client_id') || undefined,
    record_date: formData.get('record_date'),
    amount: formData.get('amount'),
    type: formData.get('type'),
    category: formData.get('category'),
    description: formData.get('description'),
  }

  const parsed = financialRecordSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const { error } = await supabase.from('financial_records').insert({
    ...parsed.data,
    client_id: parsed.data.client_id || null,
    description: parsed.data.description || null,
  })

  if (error) return { error: { _form: [error.message] } }

  revalidatePath('/financial')
  return { success: true }
}

export async function deleteFinancialRecordAction(id: string) {
  const supabase = createClient()
  await supabase.from('financial_records').delete().eq('id', id)
  revalidatePath('/financial')
}
