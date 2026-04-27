'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { surveySchema } from '@/lib/validations/survey.schema'

export async function createSurveyAction(formData: FormData) {
  const supabase = createClient()

  const parsed = surveySchema.safeParse({
    client_id: formData.get('client_id'),
    submitted_at: formData.get('submitted_at'),
    quality_score: formData.get('quality_score'),
    reliability_score: formData.get('reliability_score'),
    communication_score: formData.get('communication_score'),
    value_score: formData.get('value_score'),
    comments: formData.get('comments'),
  })

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const { error } = await supabase.from('surveys').insert({
    ...parsed.data,
    comments: parsed.data.comments || null,
    submitted_at: parsed.data.submitted_at
      ? new Date(parsed.data.submitted_at).toISOString()
      : new Date().toISOString(),
  })

  if (error) return { error: { _form: [error.message] } }

  revalidatePath('/surveys')
  revalidatePath(`/clients/${parsed.data.client_id}`)
  redirect('/surveys')
}

export async function deleteSurveyAction(id: string) {
  const supabase = createClient()
  await supabase.from('surveys').delete().eq('id', id)
  revalidatePath('/surveys')
}
