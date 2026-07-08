'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { bondJobSchema } from '@/lib/validations/bondJob.schema'

export async function createBondJobAction(formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const fget = (k: string) => (formData.get(k) as string | null) ?? undefined

  const raw = {
    client_name:   fget('client_name'),
    address:       fget('address'),
    contact_phone: fget('contact_phone'),
    clean_date:    fget('clean_date'),
    clean_time:    fget('clean_time'),
    comments:      fget('comments'),
    cleaner_id:    fget('cleaner_id'),
  }

  const parsed = bondJobSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const db = supabase as any
  let createdBy: string | null = null
  if (user) {
    const { data: profile } = await db.from('profiles').select('id').eq('user_id', user.id).single()
    createdBy = profile?.id ?? null
  }

  const { error } = await db.from('bond_jobs').insert({
    client_name:   parsed.data.client_name,
    address:       parsed.data.address,
    contact_phone: parsed.data.contact_phone || null,
    clean_date:    parsed.data.clean_date,
    clean_time:    parsed.data.clean_time || null,
    comments:      parsed.data.comments || null,
    cleaner_id:    parsed.data.cleaner_id || null,
    created_by:    createdBy,
  })

  if (error) {
    return { error: { _form: [error.message] } }
  }

  revalidatePath('/clients')
  redirect('/clients?tab=bond')
}

export async function deleteBondJobAction(id: string) {
  const supabase = createClient()
  const db = supabase as any
  await db.from('bond_jobs').delete().eq('id', id)
  revalidatePath('/clients')
}
