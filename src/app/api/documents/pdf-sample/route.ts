import { NextResponse } from 'next/server'
import React from 'react'
import { renderDocumentPdf } from '@/lib/documents/pdf'
import { ProposalDocument } from '@/components/documents/render/ProposalDocument'
import { CapabilityDocument } from '@/components/documents/render/CapabilityDocument'
import { DEFAULT_PROPOSAL } from '@/lib/documents/proposal'
import { DEFAULT_CAPABILITY } from '@/lib/documents/capability'

// TEMPORARY: render the real proposal + capability PDFs and email them, to
// validate the full pipeline (fonts, brand images, multi-page). Remove after.
export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET() {
  try {
    const data = { ...DEFAULT_PROPOSAL, clientName: 'Sample Client Pty Ltd', issueDate: '1 July 2026', startDate: '14 July 2026' }
    const proposalPdf = await renderDocumentPdf(React.createElement(ProposalDocument, { data }))
    const capPdf = await renderDocumentPdf(React.createElement(CapabilityDocument, { data: DEFAULT_CAPABILITY }))

    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY!)
    const res = await resend.emails.send({
      from: 'Delta Cleaning <hello@deltacleaning.com.au>',
      reply_to: 'hello@deltacleaning.com.au',
      to: 'jaillet09@gmail.com',
      subject: 'Sample proposal + capability statement (PDF test)',
      html: '<p>Here are the two generated PDFs so you can check the look. This is the same output the Send button produces.</p>',
      attachments: [
        { filename: 'Sample Proposal.pdf', content: proposalPdf },
        { filename: 'Capability Statement.pdf', content: capPdf },
      ],
    })
    if (res.error) return NextResponse.json({ ok: false, error: res.error.message }, { status: 500 })
    return NextResponse.json({ ok: true, proposalBytes: proposalPdf.length, capBytes: capPdf.length })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 })
  }
}
