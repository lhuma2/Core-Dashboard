import Link from 'next/link'
import { formatAUD, formatDate, tenureMonths } from '@/lib/formatters'
import { ActiveBadge } from '@/components/ui/Badge'
import type { Client } from '@/types/app'

interface TenureTableProps {
  clients: Client[]
}

export function TenureTable({ clients }: TenureTableProps) {
  const withTenure = clients
    .filter((c) => c.start_date)
    .map((c) => ({ ...c, months: tenureMonths(c.start_date) }))
    .sort((a, b) => b.months - a.months)

  const avgMonths =
    withTenure.length > 0
      ? Math.round(withTenure.reduce((s, c) => s + c.months, 0) / withTenure.length)
      : 0

  const years = Math.floor(avgMonths / 12)
  const rem = avgMonths % 12
  const avgLabel = years > 0
    ? `${years}y ${rem > 0 ? rem + 'm' : ''}`
    : `${avgMonths}m`

  return (
    <div className="space-y-4">
      <div className="bg-brand-navy/5 rounded-lg px-4 py-3 flex items-center justify-between">
        <p className="text-sm text-gray-600">Average client tenure</p>
        <p className="text-lg font-bold text-brand-navy">{avgLabel}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Client</th>
              <th className="text-left pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Started</th>
              <th className="text-center pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Tenure</th>
              <th className="text-right pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Annual Value</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {withTenure.map((c) => {
              const mo = c.months
              const yrs = Math.floor(mo / 12)
              const mos = mo % 12
              const label = yrs > 0 ? `${yrs}y ${mos > 0 ? mos + 'm' : ''}` : `${mo}m`
              return (
                <tr key={c.id}>
                  <td className="py-2.5">
                    <Link href={`/clients/${c.id}`} className="font-medium text-gray-900 hover:text-brand-navy transition">
                      {c.business_name}
                    </Link>
                  </td>
                  <td className="py-2.5 text-gray-500">{formatDate(c.start_date)}</td>
                  <td className="py-2.5 text-center">
                    <span className="font-semibold text-brand-navy">{label}</span>
                  </td>
                  <td className="py-2.5 text-right font-semibold">{formatAUD(c.annual_value)}</td>
                  <td className="py-2.5 pl-2">
                    <ActiveBadge active={c.active} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
