import { NextResponse } from 'next/server'
import React from 'react'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { renderDocumentPdf } from '@/lib/documents/pdf'
import { ProposalDocument } from '@/components/documents/render/ProposalDocument'
import { CapabilityDocument } from '@/components/documents/render/CapabilityDocument'
import { withProposalDefaults } from '@/lib/documents/proposal'
import { DEFAULT_CAPABILITY } from '@/lib/documents/capability'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  const { id, toEmail, attachCapability, message } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing document id' }, { status: 400 })
  if (!toEmail) return NextResponse.json({ error: 'Enter a recipient email address.' }, { status: 400 })

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Email is not configured.' }, { status: 500 })

  const db = createAdminClient() as any
  const { data: doc } = await db.from('proposal_documents').select('*').eq('id', id).single()
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  const data = withProposalDefaults(doc.data)

  let proposalPdf: Buffer
  try {
    proposalPdf = await renderDocumentPdf(React.createElement(ProposalDocument, { data }))
  } catch (e: any) {
    return NextResponse.json({ error: `Could not generate the proposal PDF: ${e?.message ?? 'unknown error'}` }, { status: 500 })
  }

  const safe = (s: string) => s.replace(/[^\w.\- ]/g, '').trim()
  const attachments: { filename: string; content: Buffer }[] = [
    { filename: `${safe(`Proposal ${data.refNumber} ${data.clientName}`)}.pdf`, content: proposalPdf },
  ]

  if (attachCapability) {
    try {
      const capPdf = await renderDocumentPdf(React.createElement(CapabilityDocument, { data: DEFAULT_CAPABILITY }))
      attachments.push({ filename: 'Delta Cleaning Capability Statement.pdf', content: capPdf })
    } catch { /* capability is optional — don't fail the send */ }
  }

  const firstName = (data.attention || '').split(',')[0].split(' ')[0]
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,'
  const intro = (message && String(message).trim())
    || `Thanks again for your time. Please find attached our cleaning proposal for ${data.clientName}. Everything we discussed is in there, and I'm happy to talk through any part of it.`

  const html = `
<div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; color: #1a1a1a; line-height: 1.65; max-width: 560px;">
  <p>${greeting}</p>
  <p>${intro}</p>
  ${attachCapability ? '<p>I&rsquo;ve also attached our capability statement so you have a bit more background on Delta Cleaning.</p>' : ''}
  <p>Whenever you&rsquo;re ready, just reply to this email and we&rsquo;ll lock it in.</p>
  <p style="margin-top: 22px;">
    ${data.contactName}<br/>
    Delta Cleaning · Brisbane<br/>
    <a href="mailto:${data.contactEmail}" style="color:#1e3a5f;">${data.contactEmail}</a>
  </p>
</div>`

  try {
    const { Resend } = await import('resend')
    const resend = new Resend(apiKey)
    const res = await resend.emails.send({
      from: 'Delta Cleaning <hello@deltacleaning.com.au>',
      reply_to: 'hello@deltacleaning.com.au',
      to: toEmail,
      subject: `Cleaning proposal for ${data.clientName}`,
      html,
      attachments,
    })
    if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Email failed to send' }, { status: 500 })
  }

  await db.from('proposal_documents').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', id)
  await db.from('proposal_document_versions').insert({ document_id: id, data, label: `Sent to ${toEmail}` })

  revalidatePath('/documents')
  revalidatePath(`/documents/${id}`)
  return NextResponse.json({ success: true })
}
