import Link from 'next/link'
import type { Client } from '@/types/app'
import { formatDate, formatAUD } from '@/lib/formatters'
import { ActiveBadge } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { ArrowRight } from 'lucide-react'

interface RecentClientsProps {
  clients: Client[]
}

export function RecentClients({ clients }: RecentClientsProps) {
  return (
    <Card padding={false}>
      <CardHeader className="px-6 pt-5 pb-0">
        <CardTitle>Recent Clients</CardTitle>
        <Link
          href="/clients"
          className="text-xs text-brand-navy hover:underline flex items-center gap-1"
        >
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </CardHeader>
      <div className="divide-y divide-gray-100 mt-4">
        {clients.length === 0 ? (
          <p className="px-6 py-8 text-sm text-gray-400 text-center">
            No clients yet — add your first one
          </p>
        ) : (
          clients.map((c) => (
            <Link
              key={c.id}
              href={`/clients/${c.id}`}
              className="flex items-center justify-between px-6 py-3.5 hover:bg-gray-50 transition"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {c.business_name}
                </p>
                <p className="text-xs text-gray-400">
                  Added {formatDate(c.created_at)} · {c.ref_number}
                </p>
              </div>
              <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                {c.monthly_value && (
                  <span className="text-sm font-semibold text-gray-700">
                    {formatAUD(c.monthly_value)}/mo
                  </span>
                )}
                <ActiveBadge active={c.active} />
              </div>
            </Link>
          ))
        )}
      </div>
    </Card>
  )
}
