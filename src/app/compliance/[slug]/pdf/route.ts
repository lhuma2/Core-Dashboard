import { NextResponse } from 'next/server'
import { docFileName, publicDoc } from '@/lib/hub/compliance-docs'
import { compliancePdf, pdfHeaders } from '@/lib/hub/compliance-pdf'

export const dynamic = 'force-dynamic'

/** One public compliance document as a PDF. */
export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const d = publicDoc(params.slug)
  if (!d) return new NextResponse('Not found', { status: 404 })
  const pdf = await compliancePdf([d])
  return new NextResponse(new Uint8Array(pdf), { headers: pdfHeaders(docFileName(d)) })
}
