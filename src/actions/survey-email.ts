'use server'

import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

export async function sendSurveyEmailAction(clientId: string): Promise<{ success?: boolean; error?: string; tokenId?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { error: 'RESEND_API_KEY not configured' }

  const supabase = createClient()
  const db = supabase as any

  // Load client
  const { data: client, error: clientError } = await db
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single()

  if (clientError || !client) return { error: 'Client not found' }
  if (!client.contact_email) return { error: 'Client has no email address. Add one on the edit page.' }

  // Create survey token
  const { data: tokenRow, error: tokenError } = await db
    .from('survey_tokens')
    .insert({ client_id: clientId })
    .select('token, id')
    .single()

  if (tokenError) return { error: `Failed to create survey token: ${tokenError.message}` }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://delta-operations-hub.vercel.app')
  const surveyUrl = `${baseUrl}/survey/${tokenRow.token}`
  const contactName = (client.contact_name || '').split(' ')[0] || 'there'

  const htmlBody = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;line-height:1.6;">
<div style="max-width:560px;margin:0 auto;padding:40px 24px;">

<p style="margin:0 0 16px 0;">Hi ${contactName},</p>

<p style="margin:0 0 16px 0;">Hope you're well. I just wanted to reach out personally and ask how you feel we've been going at ${client.business_name}.</p>

<p style="margin:0 0 16px 0;">I put together a short 1-minute survey — your honest feedback means a lot and helps us keep improving.</p>

<p style="margin:0 0 24px 0;"><a href="${surveyUrl}" style="color:#1a1a1a;font-weight:600;">${surveyUrl}</a></p>

<p style="margin:0 0 16px 0;">Thanks so much for your time.</p>

<p style="margin:0 0 4px 0;">Jackson Jaillet</p>
<p style="margin:0 0 4px 0;color:#555555;font-size:14px;">Founder &amp; Director, Delta Cleaning</p>
<p style="margin:0 0 4px 0;color:#555555;font-size:14px;">0412 844 237</p>
<p style="margin:0;font-size:14px;"><a href="https://www.deltacleaning.com.au" style="color:#555555;">deltacleaning.com.au</a></p>

</div>
</body>
</html>`

  const resend = new Resend(apiKey)
  const { error: sendError } = await resend.emails.send({
    from: 'Jackson Jaillet <hello@deltacleaning.com.au>',
    to: client.contact_email,
    reply_to: 'hello@deltacleaning.com.au',
    bcc: 'hello@deltacleaning.com.au',
    subject: `How are we going at ${client.business_name}?`,
    html: htmlBody,
  })

  if (sendError) {
    // Clean up the token if send failed
    await db.from('survey_tokens').delete().eq('id', tokenRow.id)
    return { error: (sendError as any).message || 'Failed to send survey email' }
  }

  return { success: true, tokenId: tokenRow.id }
}

export async function submitSurveyAction(data: {
  token: string
  qualityScore: number
  reliabilityScore: number
  communicationScore: number
  valueScore: number
  loyaltyScore: number
  comments?: string
}): Promise<{ success?: boolean; error?: string }> {
  // Use plain supabase-js (no SSR/cookie complexity) with anon key for public form
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const db = supabase as any

  // Call SECURITY DEFINER function — bypasses RLS, handles token + insert atomically
  const { data: result, error: rpcError } = await db.rpc('submit_survey', {
    p_token: data.token,
    p_quality: data.qualityScore,
    p_reliability: data.reliabilityScore,
    p_communication: data.communicationScore,
    p_value: data.valueScore,
    p_loyalty: data.loyaltyScore,
    p_comments: data.comments || null,
  })

  if (rpcError) return { error: `Failed to save survey: ${rpcError.message}` }
  if (result?.error) return { error: result.error }

  return { success: true }
}
