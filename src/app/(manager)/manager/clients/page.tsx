import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ChevronRight } from 'lucide-react'

const FREQUENCY_LABELS: Record<string, string> = {
  weekly:       'Weekly',
  fortnightly:  'Fortnightly',
  monthly:      'Monthly',
  twice_weekly: 'Twice weekly',
  three_weekly: '3x per week',
  four_weekly:  'Every 4 weeks',
  adhoc:        'Ad hoc',
}

const DAY_LABELS: Record<string, string> = {
  monday:    'Mon',
  tuesday:   'Tue',
  wednesday: 'Wed',
  thursday:  'Thu',
  friday:    'Fri',
  saturday:  'Sat',
  sunday:    'Sun',
}

export default async function ManagerClientsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: clients } = await (supabase as any)
    .from('clients')
    .select('id, business_name, address, suburb, frequency, service_days, is_multi_site, assigned_cleaner_id, profiles!clients_assigned_cleaner_id_fkey(full_name)')
    .eq('active', true)
    .order('business_name')

  const allClients: any[] = clients ?? []

  return (
    <>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Clients · {allClients.length}</p>
      <div className="space-y-2">
        {allClients.length === 0 && (
          <div className="text-center py-12 text-sm text-gray-400">No active clients</div>
        )}
        {allClients.map((client: any) => {
          const days: string[] = client.service_days ?? []
          const freqLabel = FREQUENCY_LABELS[client.frequency] ?? client.frequency ?? '—'

          return (
            <Link
              key={client.id}
              href={`/manager/clients/${client.id}`}
              className="block"
            >
              <div className="bg-white rounded-2xl px-5 py-4 flex items-center justify-between gap-3 active:bg-gray-50 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-black truncate">{client.business_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {client.is_multi_site
                      ? 'Multiple sites'
                      : ([client.address, client.suburb].filter(Boolean).join(', ') || '—')}
                  </p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {client.is_multi_site ? 'Multi-site' : freqLabel}
                    </span>
                    {days.map((d) => (
                      <span
                        key={d}
                        className="text-[11px] border border-gray-200 text-gray-500 px-2 py-0.5 rounded-full"
                      >
                        {DAY_LABELS[d.toLowerCase()] ?? d}
                      </span>
                    ))}
                    {client.assigned_cleaner_id ? (
                      <span className="text-[11px] bg-black text-white px-2 py-0.5 rounded-full">
                        {client.profiles?.full_name ?? 'Assigned'}
                      </span>
                    ) : (
                      <span className="text-[11px] border border-dashed border-gray-300 text-gray-400 px-2 py-0.5 rounded-full">
                        Unassigned
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </div>
            </Link>
          )
        })}
      </div>
    </>
  )
}
