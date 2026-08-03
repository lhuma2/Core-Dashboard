import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { flattenCompanyDocument } from '@/lib/documents/flatten'

export const runtime = 'nodejs'
export const maxDuration = 60

const safe = (s: string) => s.replace(/[^\w.\- ]/g, '').trim()

// Downloads a signed "company document" (uploaded PDF + placed fields) with the
// signature and every filled-in field baked permanently into the PDF itself.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const db = createAdminClient() as any
  const { data: doc } = await db.from('proposal_documents').select('*').eq('id', params.id).single()
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  if (!doc.pdf_url) return NextResponse.json({ error: 'This document has no PDF attached.' }, { status: 400 })

  const sourceRes = await fetch(doc.pdf_url)
  if (!sourceRes.ok) return NextResponse.json({ error: 'Could not load the original PDF.' }, { status: 502 })
  const sourceBytes = new Uint8Array(await sourceRes.arrayBuffer())

  let flattened: Uint8Array
  try {
    flattened = await flattenCompanyDocument(
      sourceBytes,
      doc.data?.placements ?? [],
      doc.data?.fieldValues ?? {},
    )
  } catch (e: any) {
    return NextResponse.json({ error: `Could not generate the PDF: ${e?.message ?? 'unknown error'}` }, { status: 500 })
  }

  const filename = `${safe(doc.client_name || 'Signed Document')}${doc.status === 'signed' ? ' - Signed' : ''}.pdf`
  return new NextResponse(Buffer.from(flattened), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
