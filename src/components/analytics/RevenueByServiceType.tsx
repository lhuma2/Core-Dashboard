import { ClientBreakdownPie } from '@/components/charts/ClientBreakdownPie'
import { formatAUD } from '@/lib/formatters'
import { SERVICE_TYPE_LABELS } from '@/lib/constants'
import type { Client, ServiceType } from '@/types/app'

interface RevenueByServiceTypeProps {
  clients: Client[]
}

export function RevenueByServiceType({ clients }: RevenueByServiceTypeProps) {
  const revenueMap: Record<string, number> = {}

  for (const client of clients.filter(c => c.active)) {
    const types = (client.service_type as ServiceType[]) || []
    const perType = (client.monthly_value || 0) / Math.max(types.length, 1)
    for (const type of types) {
      const label = SERVICE_TYPE_LABELS[type]
      revenueMap[label] = (revenueMap[label] || 0) + perType
    }
  }

  const data = Object.entries(revenueMap)
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value)

  return (
    <div className="space-y-4">
      <ClientBreakdownPie data={data} />
      <div className="space-y-2">
        {data.map(d => (
          <div key={d.name} className="flex items-center justify-between text-sm">
            <span className="text-gray-500">{d.name}</span>
            <span className="font-semibold text-gray-900 tabular-nums">{formatAUD(d.value)}/mo</span>
          </div>
        ))}
      </div>
    </div>
  )
}
