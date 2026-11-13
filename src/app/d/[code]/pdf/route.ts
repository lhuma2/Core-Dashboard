import { NextResponse } from 'next/server'
import { sharedDocs } from '@/lib/hub/compliance-share'
import { compliancePdf, pdfHeaders } from '@/lib/hub/compliance-pdf'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Every shared document in one PDF. */
export async function GET(_req: Request, { params }: { params: { code: string } }) {
  const docs = await sharedDocs(params.code)
  if (!docs) return new NextResponse('This link isn’t valid.', { status: 404 })
  return new NextResponse(new Uint8Array(await compliancePdf(docs)), { headers: pdfHeaders('Core Cleaning compliance documents.pdf') })
}
