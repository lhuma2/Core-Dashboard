import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/require-staff'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/** Open file: a short-lived link to a file filed under a client (staff only). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const denied = await requireStaff()
  if (denied) return new NextResponse(denied, { status: 401 })
  if (!/^[0-9a-f-]{36}$/.test(params.id)) return new NextResponse('That file isn’t there any more.', { status: 404 })
  const { data, error } = await (createClient() as any).from('client_files').select('path, file_name').eq('id', params.id).is('deleted_at', null).maybeSingle()
  if (error) return new NextResponse('Couldn’t reach the hub. Try again in a minute.', { status: 503 })
  if (!data) return new NextResponse('That file isn’t there any more.', { status: 404 })
  const s = await createAdminClient().storage.from('client-files').createSignedUrl(data.path, 300)
  if (s.error || !s.data?.signedUrl) return new NextResponse('Couldn’t open the file. Try again in a minute.', { status: 503 })
  return NextResponse.redirect(s.data.signedUrl)
}
