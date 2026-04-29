export const dynamic = 'force-dynamic'
export const revalidate = 0

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { EditCleanerModal } from '@/components/portal/manager/EditCleanerModal'
import { DeletePortalUserButton } from '@/components/team/DeletePortalUserButton'
import { ManagerAddCleanerForm } from '@/components/portal/manager/ManagerAddCleanerForm'
import { UserCircle, Plus } from 'lucide-react'

export default async function ManagerTeamPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: members } = await (supabase as any)
    .from('profiles')
    .select('id, user_id, full_name, email, role')
    .eq('role', 'cleaner')
    .order('full_name')

  const cleaners = members ?? []

  return (
    <>

      {/* ── Cleaners ──────────────────────────────────── */}
      <section className="mb-8">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Cleaners · {cleaners.length}
        </p>

        {cleaners.length === 0 && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4 mb-4">
            <p className="text-sm font-semibold text-amber-800">No cleaners added yet</p>
            <p className="text-xs text-amber-600 mt-1">Use the form below to add your first cleaner. They'll get a login to the cleaner portal.</p>
          </div>
        )}

        <div className="space-y-2 mb-4">
          {cleaners.map((m: any) => (
            <div key={m.id} className="bg-white rounded-2xl px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <UserCircle className="w-5 h-5 text-gray-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-black">{m.full_name ?? '—'}</p>
                  {m.email && (
                    <p className="text-xs text-gray-400 font-mono">
                      Username: {m.email.replace('@delta-cleaner.internal', '')}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <EditCleanerModal
                  profileId={m.id}
                  userId={m.user_id}
                  fullName={m.full_name ?? ''}
                  email={m.email ?? ''}
                />
                <DeletePortalUserButton userId={m.user_id} userName={m.full_name} />
              </div>
            </div>
          ))}
        </div>

        {/* Add cleaner */}
        <div className="bg-white rounded-2xl px-5 py-5">
          <div className="flex items-center gap-2 mb-4">
            <Plus className="w-4 h-4 text-black" />
            <p className="text-sm font-semibold text-black">Add Cleaner</p>
          </div>
          <ManagerAddCleanerForm />
        </div>
      </section>

    </>
  )
}
