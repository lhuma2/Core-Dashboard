import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/require-staff'
import { capabilityStatement } from '@/lib/hub/capability'
import { pdfHeaders } from '@/lib/hub/compliance-pdf'

export const dynamic = 'force-dynamic'

/** The capability statement that Walk-through and Follow-up email, to open from Prospecting. */
export async function GET(req: Request) {
  if (await requireStaff()) return NextResponse.redirect(new URL('/login', req.url))
  const pdf = await capabilityStatement()
  if (!pdf) return new NextResponse('Not found', { status: 404 })
  return new NextResponse(new Uint8Array(pdf), { headers: pdfHeaders('Core Cleaning Capability Statement.pdf', true) })
}
