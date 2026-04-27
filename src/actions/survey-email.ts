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
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">

    <div style="font-size:15px;color:#1a1a1a;line-height:1.7;">
      <p style="margin:0 0 14px 0;font-size:15px;color:#1a1a1a;line-height:1.7;font-family:Arial,sans-serif;">Hi ${contactName},</p>
      <p style="margin:0 0 14px 0;font-size:15px;color:#1a1a1a;line-height:1.7;font-family:Arial,sans-serif;">We'd love to hear how we're going at ${client.business_name}. It takes about a minute to complete.</p>
      <p style="margin:0 0 14px 0;font-size:15px;color:#1a1a1a;line-height:1.7;font-family:Arial,sans-serif;">Your honest feedback helps us keep improving our service.</p>
    </div>

    <!-- CTA Button -->
    <div style="margin:28px 0;">
      <a href="${surveyUrl}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:600;font-family:Arial,sans-serif;">
        Complete Survey →
      </a>
    </div>

    <div style="font-size:13px;color:#777777;margin-bottom:24px;font-family:Arial,sans-serif;">
      <p style="margin:0;">Or copy this link: <a href="${surveyUrl}" style="color:#1a1a1a;">${surveyUrl}</a></p>
    </div>

    <!-- Signature -->
    <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e5e7eb;">
      <p style="margin:0 0 2px;font-size:14px;color:#1a1a1a;font-family:Arial,sans-serif;">Best regards,</p>
      <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#1a1a1a;font-family:Arial,sans-serif;">Jackson Jaillet</p>
      <p style="margin:0 0 1px;font-size:13px;color:#555555;font-family:Arial,sans-serif;">Founder &amp; Director, Delta Cleaning</p>
      <p style="margin:0 0 1px;font-size:13px;color:#555555;font-family:Arial,sans-serif;">0412 844 237</p>
      <a href="https://www.deltacleaning.com.au" style="font-size:13px;color:#1a56db;text-decoration:none;font-family:Arial,sans-serif;">deltacleaning.com.au</a>
    </div>

  </div>
</body>
</html>`

  const resend = new Resend(apiKey)
  const { error: sendError } = await resend.emails.send({
    from: 'Jackson Jaillet <hello@deltacleaning.com.au>',
    to: client.contact_email,
    reply_to: 'hello@deltacleaning.com.au',
    bcc: 'hello@deltacleaning.com.au',
    subject: `Quick survey — how are we going at ${client.business_name}?`,
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
