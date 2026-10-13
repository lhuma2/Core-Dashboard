import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToRole } from '@/lib/push'
import { FOLLOW_UP_STATUSES, followUpState } from '@/lib/documents/follow-up'

// Every morning: let the owner know which sent quotes are due a follow-up call.
export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient() as any
  const { data: rows, error } = await db
    .from('proposal_documents')
    .select('id, status, sent_at, client_name, title, data')
    .eq('kind', 'proposal')
    .in('status', FOLLOW_UP_STATUSES)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const due = (rows ?? []).filter((r: any) => followUpState(r)?.due)
  if (!due.length) return NextResponse.json({ due: 0 })

  const names = due.map((r: any) => r.client_name || r.title || 'a client')
  const listed = names.length > 3 ? `${names.slice(0, 3).join(', ')} and ${names.length - 3} more` : names.join(', ')
  await sendPushToRole('admin', {
    title: due.length === 1 ? 'A quote follow-up call is due today' : `${due.length} quote follow-up calls are due today`,
    body: `Call ${listed}.`,
    url: due.length === 1 ? `/documents/${due[0].id}` : '/documents',
  })
  return NextResponse.json({ due: due.length })
}
