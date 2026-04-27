'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { sopSchema } from '@/lib/validations/sop.schema'

export async function createSOPAction(formData: FormData) {
  const supabase = createClient()

  const parsed = sopSchema.safeParse({
    title: formData.get('title'),
    category: formData.get('category'),
    content: formData.get('content'),
    active: true,
  })

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const { data: sop, error } = await supabase
    .from('sops')
    .insert(parsed.data)
    .select('id')
    .single()

  if (error) return { error: { _form: [error.message] } }

  revalidatePath('/sops')
  redirect(`/sops/${sop.id}`)
}

export async function updateSOPAction(id: string, formData: FormData) {
  const supabase = createClient()

  // Get current version
  const { data: existing } = await supabase
    .from('sops')
    .select('version')
    .eq('id', id)
    .single()

  const parsed = sopSchema.safeParse({
    title: formData.get('title'),
    category: formData.get('category'),
    content: formData.get('content'),
    active: formData.get('active') !== 'false',
  })

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const { error } = await supabase
    .from('sops')
    .update({
      ...parsed.data,
      version: (existing?.version || 1) + 1,
    })
    .eq('id', id)

  if (error) return { error: { _form: [error.message] } }

  revalidatePath('/sops')
  revalidatePath(`/sops/${id}`)
  redirect(`/sops/${id}`)
}

export async function archiveSOPAction(id: string) {
  const supabase = createClient()
  await supabase.from('sops').update({ active: false }).eq('id', id)
  revalidatePath('/sops')
  revalidatePath(`/sops/${id}`)
}
