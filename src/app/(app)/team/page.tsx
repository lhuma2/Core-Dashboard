export const dynamic = 'force-dynamic'
export const revalidate = 0

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { CreatePortalUserForm } from '@/components/team/CreatePortalUserForm'
import { DeletePortalUserButton } from '@/components/team/DeletePortalUserButton'
import { EditPortalUserModal } from '@/components/team/EditPortalUserModal'
import { Users, UserCircle, CalendarDays, ChevronRight, ShieldCheck, Sparkles, Building2 } from 'lucide-react'

const ROLE_LABELS: Record<string, string> = {
  cleaner: 'Cleaner', manager: 'Team Manager', client: 'Client Portal', admin: 'Admin',
}
const ROLE_COLORS: Record<string, string> = {
  cleaner: 'bg-gray-100 text-gray-600', manager: 'bg-blue-50 text-blue-700',
  client: 'bg-emerald-50 text-emerald-700', admin: 'bg-purple-50 text-purple-700',
}

export default async function TeamPage() {
  const supabase = createClient()

  const [{ data: profiles, error: profilesError }, { data: allClients }, { data: jobRows }] = await Promise.all([
    (supabase as any)
      .from('profiles')
      .select('id, user_id, role, full_name, email, linked_client_id, created_at')
      .order('full_name'),
    (supabase as any).from('clients').select('id, business_name').order('business_name'),
    (supabase as any).from('job_assignments').select('cleaner_id, status'),
  ])

  const clientMap = new Map((allClients ?? []).map((c: any) => [c.id, c.business_name]))

  // Completed-job counts per cleaner for a quick stat on each row
  const completedByCleaner = new Map<string, number>()
  for (const j of (jobRows ?? []) as any[]) {
    if (j.status === 'completed' && j.cleaner_id) {
      completedByCleaner.set(j.cleaner_id, (completedByCleaner.get(j.cleaner_id) ?? 0) + 1)
    }
  }

  const users: any[] = (profiles ?? []).map((p: any) => ({
    ...p,
    clientName: p.linked_client_id ? clientMap.get(p.linked_client_id) ?? null : null,
    completedJobs: completedByCleaner.get(p.id) ?? 0,
  }))

  const clients = (allClients ?? []).filter((c: any) => c)
  const managers = users.filter((u) => u.role === 'manager' || u.role === 'admin')
  const cleaners = users.filter((u) => u.role === 'cleaner')
  const clientUsers = users.filter((u) => u.role === 'client')

  function UserRow({ u, href }: { u: any; href?: string }) {
    const left = (
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
          <UserCircle className="w-5 h-5 text-gray-500" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{u.full_name ?? '—'}</p>
          {u.clientName && <p className="text-xs text-gray-500 mt-0.5 truncate">{u.clientName}</p>}
          {u.role === 'cleaner' && (
            <p className="text-xs text-gray-400 mt-0.5">{u.completedJobs} job{u.completedJobs === 1 ? '' : 's'} completed</p>
          )}
        </div>
      </div>
    )
    return (
      <div className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
        {href ? <Link href={href} className="min-w-0 flex-1">{left}</Link> : left}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ROLE_COLORS[u.role] ?? ROLE_COLORS.admin}`}>
            {ROLE_LABELS[u.role] ?? u.role}
          </span>
          {href ? (
            <Link href={href} className="text-gray-300 hover:text-gray-500"><ChevronRight className="w-4 h-4" /></Link>
          ) : (
            <EditPortalUserModal
              profileId={u.id} userId={u.user_id} fullName={u.full_name ?? ''}
              email={u.email ?? ''} role={u.role} linkedClientId={u.linked_client_id}
              clients={clients ?? []}
            />
          )}
          <DeletePortalUserButton userId={u.user_id} userName={u.full_name} />
        </div>
      </div>
    )
  }

  function Section({ title, icon: Icon, list, linkCleaners }: { title: string; icon: any; list: any[]; linkCleaners?: boolean }) {
    return (
      <Card padding={false}>
        <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-2">
          <Icon className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          <span className="text-xs text-gray-400 tabular-nums">· {list.length}</span>
        </div>
        {list.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-400">None yet</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {list.map((u) => (
              <UserRow key={u.id} u={u} href={linkCleaners ? `/team/cleaners/${u.id}` : undefined} />
            ))}
          </div>
        )}
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-gray-900">Team &amp; Portal Users</h1>
          <p className="text-sm text-gray-500 mt-1">Managers, cleaners and client accounts in one place.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/team/compliance"><Button variant="secondary"><CalendarDays className="w-4 h-4" /> Compliance Docs</Button></Link>
          <Link href="/team/jobs"><Button><CalendarDays className="w-4 h-4" /> Manage Jobs</Button></Link>
        </div>
      </div>

      {profilesError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          Query error: {profilesError.message}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Add Portal User</h2>
            <CreatePortalUserForm clients={clients ?? []} />
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Section title="Managers" icon={ShieldCheck} list={managers} />
          <Section title="Cleaners" icon={Sparkles} list={cleaners} linkCleaners />
          <Section title="Clients" icon={Building2} list={clientUsers} />
        </div>
      </div>
    </div>
  )
}
