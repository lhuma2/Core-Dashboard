import { formatAUD } from '@/lib/formatters'
import type { Client } from '@/types/app'

interface SuburbBreakdownProps {
  clients: Client[]
}

export function SuburbBreakdown({ clients }: SuburbBreakdownProps) {
  const active = clients.filter((c) => c.active)

  const suburbMap: Record<string, { count: number; monthly: number }> = {}
  for (const c of active) {
    const suburb = c.suburb || 'Unknown'
    if (!suburbMap[suburb]) suburbMap[suburb] = { count: 0, monthly: 0 }
    suburbMap[suburb].count++
    suburbMap[suburb].monthly += c.monthly_value || 0
  }

  const rows = Object.entries(suburbMap)
    .map(([suburb, data]) => ({ suburb, ...data }))
    .sort((a, b) => b.monthly - a.monthly)

  const totalMRR = rows.reduce((s, r) => s + r.monthly, 0)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Suburb</th>
            <th className="text-center pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Clients</th>
            <th className="text-right pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Monthly</th>
            <th className="text-right pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Share</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((r) => {
            const pct = totalMRR > 0 ? (r.monthly / totalMRR) * 100 : 0
            return (
              <tr key={r.suburb}>
                <td className="py-2.5 font-medium text-gray-900">{r.suburb}</td>
                <td className="py-2.5 text-center text-gray-500">{r.count}</td>
                <td className="py-2.5 text-right font-semibold">{formatAUD(r.monthly)}</td>
                <td className="py-2.5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-navy rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 w-8 text-right">{pct.toFixed(0)}%</span>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
