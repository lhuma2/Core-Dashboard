'use client'

import Link from 'next/link'
import { TrendingUp, TrendingDown, Minus, AlertTriangle, ChevronRight } from 'lucide-react'
import { formatAUD } from '@/lib/formatters'
import { monthLabel } from '@/lib/calendar'

export interface PLRow {
  id: string
  client_id: string
  client_name: string
  month: string              // "YYYY-MM-01"
  invoice_id: string | null  // null = projected (no invoice uploaded yet)
  service_count: number | null
  income_ex_gst: number | null
  rate_per_visit: number | null
  cleaner_hours: number | null
  cleaner_rate_per_hour: number | null
  cleaner_cost_ex_gst: number | null
  cleaner_gst: number | null
  cleaner_cost_incl_gst: number | null
  profit: number | null
  margin_pct: number | null
  expected_hours: number | null
  expected_cost_ex_gst: number | null
  hours_variance: number | null
  cost_variance: number | null
}

interface Props {
  rows: PLRow[]
  month?: string   // filter to specific month
  showClient?: boolean
}

function MarginPill({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-slate-600 text-xs">—</span>
  const color = pct >= 55 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    : pct >= 35 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    : 'text-red-400 bg-red-500/10 border-red-500/20'
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${color}`}>
      {pct.toFixed(0)}%
    </span>
  )
}

function VarianceCell({ variance, isHours }: { variance: number | null; isHours?: boolean }) {
  if (variance == null) return <span className="text-slate-600 text-xs">—</span>
  const abs = Math.abs(variance)
  const over = variance > 0
  const display = isHours ? `${variance > 0 ? '+' : ''}${variance.toFixed(1)}h` : `${variance > 0 ? '+' : '-'}${formatAUD(abs)}`
  const color = over ? 'text-red-400' : variance < 0 ? 'text-emerald-400' : 'text-slate-500'
  const Icon = over ? TrendingUp : variance < 0 ? TrendingDown : Minus
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${color}`}>
      <Icon className="w-3 h-3" />{display}
    </span>
  )
}

export function MonthlyPLTable({ rows, month, showClient = true }: Props) {
  const filtered = month ? rows.filter(r => r.month === `${month}-01` || r.month.startsWith(month)) : rows

  if (filtered.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-slate-500">No P&L data yet</p>
        <p className="text-xs text-slate-600 mt-1">Upload a cleaner invoice to generate per-client P&L</p>
      </div>
    )
  }

  // Group by month
  const byMonth: Record<string, PLRow[]> = {}
  for (const r of filtered) {
    const key = r.month.substring(0, 7) // "YYYY-MM"
    if (!byMonth[key]) byMonth[key] = []
    byMonth[key].push(r)
  }
  const sortedMonths = Object.keys(byMonth).sort().reverse()

  return (
    <div className="space-y-6">
      {sortedMonths.map(mk => {
        const monthRows = byMonth[mk]
        const totalIncome   = monthRows.reduce((s, r) => s + (r.income_ex_gst ?? 0), 0)
        const totalCost     = monthRows.reduce((s, r) => s + (r.cleaner_cost_ex_gst ?? 0), 0)
        const totalProfit   = monthRows.reduce((s, r) => s + (r.profit ?? 0), 0)
        const totalMargin   = totalIncome > 0 ? (totalProfit / totalIncome) * 100 : null

        return (
          <div key={mk} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            {/* Month header */}
            <div className="flex items-center justify-between px-5 py-3 bg-slate-700/30 border-b border-slate-700">
              <p className="text-sm font-semibold text-slate-200">{monthLabel(mk + '-01')}</p>
              <div className="flex items-center gap-5 text-xs">
                <span className="text-slate-400">Revenue <span className="text-slate-200 font-semibold ml-1 tabular-nums">{formatAUD(totalIncome)}</span></span>
                <span className="text-slate-400">Cost <span className="text-slate-200 font-semibold ml-1 tabular-nums">{formatAUD(totalCost)}</span></span>
                <span className="text-slate-400">Profit <span className={`font-bold ml-1 tabular-nums ${totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatAUD(totalProfit)}</span></span>
                <MarginPill pct={totalMargin} />
              </div>
            </div>

            {/* Table */}
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700/50">
                  {showClient && <th className="text-left text-xs text-slate-500 font-medium px-5 py-2">Client</th>}
                  <th className="text-right text-xs text-slate-500 font-medium px-4 py-2">Visits</th>
                  <th className="text-right text-xs text-slate-500 font-medium px-4 py-2">Revenue</th>
                  <th className="text-right text-xs text-slate-500 font-medium px-4 py-2">Hours</th>
                  <th className="text-right text-xs text-slate-500 font-medium px-4 py-2">Cleaner Cost</th>
                  <th className="text-right text-xs text-slate-500 font-medium px-4 py-2">Profit</th>
                  <th className="text-center text-xs text-slate-500 font-medium px-4 py-2">Margin</th>
                  <th className="text-center text-xs text-slate-500 font-medium px-4 py-2">Hr Variance</th>
                  <th className="text-center text-xs text-slate-500 font-medium px-4 py-2">Cost Variance</th>
                  {showClient && <th className="px-3 py-2" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {monthRows.map(row => (
                  <tr key={row.id} className="hover:bg-slate-700/20 transition-colors group">
                    {showClient && (
                      <td className="px-5 py-3">
                        <p className="text-sm font-medium text-slate-200">{row.client_name}</p>
                        {row.rate_per_visit && (
                          <p className="text-xs text-slate-500">{formatAUD(row.rate_per_visit)}/visit</p>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right text-sm text-slate-300 tabular-nums">{row.service_count ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-slate-200 tabular-nums">{row.income_ex_gst != null ? formatAUD(row.income_ex_gst) : '—'}</td>
                    <td className="px-4 py-3 text-right text-sm text-slate-300 tabular-nums">
                      {row.cleaner_hours != null ? `${row.cleaner_hours}h` : '—'}
                      {row.cleaner_rate_per_hour && (
                        <span className="text-xs text-slate-500 block">{formatAUD(row.cleaner_rate_per_hour)}/hr</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-slate-300 tabular-nums">{row.cleaner_cost_ex_gst != null ? formatAUD(row.cleaner_cost_ex_gst) : '—'}</td>
                    <td className={`px-4 py-3 text-right text-sm font-semibold tabular-nums ${(row.profit ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {row.profit != null ? formatAUD(row.profit) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center"><MarginPill pct={row.margin_pct} /></td>
                    <td className="px-4 py-3 text-center"><VarianceCell variance={row.hours_variance} isHours /></td>
                    <td className="px-4 py-3 text-center"><VarianceCell variance={row.cost_variance} /></td>
                    {showClient && (
                      <td className="px-3 py-3">
                        <Link href={`/clients/${row.client_id}`}
                          className="text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
