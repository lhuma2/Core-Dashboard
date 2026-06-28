import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// POST /api/xero/approve
// Body: { xeroId, type, contact, amount, date, action: 'approve' | 'ignore' }
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { xeroId, type, contact, description, amount, date, action } = body

  if (!xeroId || !action) {
    return NextResponse.json({ error: 'Missing xeroId or action' }, { status: 400 })
  }

  const supabase = createAdminClient()

  if (action === 'approve') {
    const { error } = await (supabase as any)
      .from('xero_approved_transactions')
      .upsert({
        xero_id: xeroId,
        type,
        contact,
        description,
        amount,
        date,
      }, { onConflict: 'xero_id' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'ignore') {
    // Delete from approved if it was previously approved
    await (supabase as any)
      .from('xero_approved_transactions')
      .delete()
      .eq('xero_id', xeroId)

    // Mark as ignored
    const { error } = await (supabase as any)
      .from('xero_ignored_transactions')
      .upsert({ xero_id: xeroId }, { onConflict: 'xero_id' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'action must be approve or ignore' }, { status: 400 })
}

// DELETE /api/xero/approve?xeroId=xxx — remove from approved (undo)
export async function DELETE(request: NextRequest) {
  const xeroId = request.nextUrl.searchParams.get('xeroId')
  if (!xeroId) return NextResponse.json({ error: 'Missing xeroId' }, { status: 400 })

  const supabase = createAdminClient()
  await (supabase as any).from('xero_approved_transactions').delete().eq('xero_id', xeroId)
  await (supabase as any).from('xero_ignored_transactions').delete().eq('xero_id', xeroId)

  return NextResponse.json({ ok: true })
}
