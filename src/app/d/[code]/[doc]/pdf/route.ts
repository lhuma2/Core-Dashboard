import { NextResponse } from 'next/server'
import { sharedDocs } from '@/lib/hub/compliance-share'
import { docFileName, docSlug } from '@/lib/hub/compliance-docs'
import { compliancePdf, pdfHeaders } from '@/lib/hub/compliance-pdf'

export const dynamic = 'force-dynamic'

/** One shared document as a PDF. */
export async function GET(_req: Request, { params }: { params: { code: string; doc: string } }) {
  const d = (await sharedDocs(params.code))?.find(x => docSlug(x.id) === String(params.doc).toLowerCase())
  if (!d) return new NextResponse('This link isn’t valid.', { status: 404 })
  return new NextResponse(new Uint8Array(await compliancePdf([d])), { headers: pdfHeaders(docFileName(d)) })
}
