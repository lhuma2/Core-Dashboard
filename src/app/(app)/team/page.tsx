export const dynamic = 'force-dynamic'
export const revalidate = 0

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { CreatePortalUserForm } from '@/components/team/CreatePortalUserForm'
import { DeletePortalUserButton } from '@/components/team/DeletePortalUserButton'
import { LinkClientButton } from '@/components/team/LinkClientButton'
import { EditPortalUserModal } from '@/components/team/EditPortalUserModal'
import { Users, UserCircle, CalendarDays } from 'lucide-react'

const ROLE_LABELS: Record<string, string> = {
  cleaner: 'Cleaner',
  manager: 'Team Manager',
  client:  'Client Portal',
  admin:   'Admin',
}

const ROLE_COLORS: Record<string, string> = {
  cleaner: 'bg-gray-100 text-gray-600',
  manager: 'bg-blue-50 text-blue-700',
  client:  'bg-emerald-50 text-emerald-700',
  admin:   'bg-purple-50 text-purple-700',
}

export default async function TeamPage() {
  // Use SSR client for reads — all tables have open RLS for authenticated users
  const supabase = createClient()

  const { data: profiles, error: profilesError } = await (supabase as any)
    .from('profiles')
    .select('id, user_id, role, full_name, email, linked_client_id, created_at')
    .order('role')
    .order('full_name')

  const { data: allClients } = await (supabase as any)
    .from('clients')
    .select('id, business_name, contact_name, contact_email')
    .order('business_name')

  const clientMap = new Map((allClients ?? []).map((c: any) => [c.id, c.business_name]))

  // Merge client name into each profile manually
  const users: any[] = (profiles ?? []).map((p: any) => ({
    ...p,
    clients: p.linked_client_id
      ? { business_name: clientMap.get(p.linked_client_id) ?? null }
      : null,
  }))

  // Active clients for the "link client" dropdown in create form
  const clients = (allClients ?? []).filter((c: any) => c)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Team & Portal Users</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage cleaner, manager, and client portal accounts.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/team/compliance">
            <Button variant="secondary">
              <CalendarDays className="w-4 h-4" />
              Compliance Docs
            </Button>
          </Link>
          <Link href="/team/jobs">
            <Button>
              <CalendarDays className="w-4 h-4" />
              Manage Jobs
            </Button>
          </Link>
        </div>
      </div>

      {profilesError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
          Query error: {profilesError.message}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Create user form */}
        <div className="lg:col-span-1">
          <Card>
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Add Portal User</h2>
            <CreatePortalUserForm clients={clients ?? []} />
          </Card>
        </div>

        {/* User list */}
        <div className="lg:col-span-2">
          <Card padding={false}>
            <div className="px-5 py-4 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900">
                Portal Users · {users.length}
              </h2>
            </div>
            {users.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="w-8 h-8 text-gray-400 mb-3" />
                <p className="text-sm text-gray-500">No portal users yet</p>
                <p className="text-xs text-gray-400 mt-1">Add a cleaner, manager, or client.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <UserCircle className="w-5 h-5 text-gray-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{u.full_name ?? '—'}</p>
                        {u.clients?.business_name && (
                          <p className="text-xs text-gray-500 mt-0.5">{u.clients.business_name}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">
                          Added {new Date(u.created_at).toLocaleDateString('en-AU', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ROLE_COLORS[u.role] ?? ROLE_COLORS.admin}`}>
                        {ROLE_LABELS[u.role] ?? u.role}
                      </span>
                      <EditPortalUserModal
                        profileId={u.id}
                        userId={u.user_id}
                        fullName={u.full_name ?? ''}
                        email={u.email ?? ''}
                        role={u.role}
                        linkedClientId={u.linked_client_id}
                        clients={clients ?? []}
                      />
                      <DeletePortalUserButton userId={u.user_id} userName={u.full_name} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
