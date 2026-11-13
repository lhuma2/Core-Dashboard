import React from 'react'
import { NextResponse } from 'next/server'
import { clientMe } from '@/lib/clientapp/data'
import { renderDocumentPdf } from '@/lib/documents/pdf'
import { CapabilityDocument } from '@/components/documents/render/CapabilityDocument'
import { DEFAULT_CAPABILITY } from '@/lib/documents/capability'

export const dynamic = 'force-dynamic'

/** Our capability statement as a PDF, for signed-in clients. */
export async function GET(req: Request) {
  if (!(await clientMe())) return NextResponse.redirect(new URL('/client/login', req.url))
  const pdf = await renderDocumentPdf(React.createElement(CapabilityDocument, { data: DEFAULT_CAPABILITY as any }))
  return new NextResponse(new Uint8Array(pdf), { headers: { 'content-type': 'application/pdf', 'content-disposition': 'inline; filename="Core-Cleaning-Capability-Statement.pdf"', 'cache-control': 'private, no-store' } })
}
