export const dynamic = 'force-dynamic'
export const revalidate = 0

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ClientShell } from '@/components/portal/ClientShell'
import { ServiceRequestCard } from '@/components/portal/client/ServiceRequestCard'
import { Wrench, CalendarClock } from 'lucide-react'

const SERVICE_CARDS = [
  { name: 'Window Cleaning' },
  { name: 'Pressure Washing' },
  { name: 'Carpet Cleaning' },
  { name: 'Floor Scrubbing' },
  { name: 'Deep Clean' },
]

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'Australia/Brisbane',
  })
}

function isWithin30Days(dateStr: string) {
  const target = new Date(dateStr)
  const now = new Date()
  const diff = (target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  return diff >= 0 && diff <= 30
}

export default async function ClientServicesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!profile) redirect('/login')

  const clientId = profile.linked_client_id

  if (!clientId) {
    return (
      <ClientShell userName={profile?.full_name} activePath="/client/services">
        <div className="text-center py-20">
          <p className="text-gray-500 text-sm">Your account is not linked to a client. Contact Delta Cleaning.</p>
        </div>
      </ClientShell>
    )
  }

  const { data: client } = await (supabase as any)
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single()

  // additional_services is jsonb array on clients: [{name, frequency, lastCompleted, nextDue}]
  const additionalServices: any[] = client?.additional_services ?? []
  const upcomingServices = additionalServices.filter((s) => s.nextDue && isWithin30Days(s.nextDue))

  return (
    <ClientShell
      clientName={client?.business_name}
      userName={profile.full_name}
      activePath="/client/services"
    >
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <Wrench className="w-6 h-6 text-black" />
          <h1 className="text-3xl font-bold text-black tracking-tight">Services</h1>
        </div>
        <p className="text-gray-500 text-sm">Your scheduled services and additional service requests.</p>
      </div>

      {/* Current additional services */}
      {additionalServices.length > 0 && (
        <section className="mb-10">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Your Services</p>
          <div className="space-y-3">
            {additionalServices.map((service: any, i: number) => (
              <div key={i} className="bg-white rounded-2xl px-6 py-5 border border-gray-100">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-black">{service.name}</p>
                    {service.frequency && (
                      <p className="text-xs text-gray-400 mt-0.5">{service.frequency}</p>
                    )}
                    {service.lastCompleted && (
                      <p className="text-xs text-gray-400 mt-1">
                        Last completed: {formatDate(service.lastCompleted)}
                      </p>
                    )}
                  </div>
                  {service.nextDue && (
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-0.5">Next Due</p>
                      <p className={`text-sm font-bold ${isWithin30Days(service.nextDue) ? 'text-black' : 'text-gray-500'}`}>
                        {formatDate(service.nextDue)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Upcoming within 30 days */}
      {upcomingServices.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <CalendarClock className="w-4 h-4 text-black" />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Due in the Next 30 Days</p>
          </div>
          <div className="space-y-2">
            {upcomingServices.map((service: any, i: number) => (
              <div key={i} className="flex items-center justify-between bg-white rounded-2xl px-6 py-4 border border-gray-200">
                <p className="text-sm font-semibold text-black">{service.name}</p>
                <span className="text-xs font-semibold text-black border border-black px-3 py-1 rounded-full">
                  {formatDate(service.nextDue)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Request a Service */}
      <section>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Request a Service</p>
        <p className="text-sm text-gray-500 mb-5">
          Select a service below to request a quote. We'll get back to you promptly.
        </p>
        <div className="space-y-3">
          {SERVICE_CARDS.map((card) => (
            <ServiceRequestCard
              key={card.name}
              serviceName={card.name}
              clientId={clientId}
            />
          ))}
        </div>
      </section>
    </ClientShell>
  )
}
