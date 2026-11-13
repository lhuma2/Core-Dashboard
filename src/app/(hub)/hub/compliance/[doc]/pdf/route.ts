import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/require-staff'
import { docBySlug, docFileName } from '@/lib/hub/compliance-docs'
import { compliancePdf, pdfHeaders } from '@/lib/hub/compliance-pdf'

export const dynamic = 'force-dynamic'

/** One compliance document as a PDF, for the hub. */
export async function GET(req: Request, { params }: { params: { doc: string } }) {
  if (await requireStaff()) return NextResponse.redirect(new URL('/login', req.url))
  const d = docBySlug(params.doc)
  if (!d) return new NextResponse('Not found', { status: 404 })
  const pdf = await compliancePdf([d])
  return new NextResponse(new Uint8Array(pdf), { headers: pdfHeaders(docFileName(d)) })
}
