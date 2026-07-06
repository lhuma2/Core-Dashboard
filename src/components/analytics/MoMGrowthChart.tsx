'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { formatAUD, formatAUDCompact } from '@/lib/formatters'

interface DataPoint {
  month: string
  revenue: number
  growth: number | null
}

interface MoMGrowthChartProps {
  data: DataPoint[]
}

export function MoMGrowthChart({ data }: MoMGrowthChartProps) {
  const hasData = data.some((d) => d.revenue > 0)

  if (!hasData) {
    return (
      <div className="h-[220px] flex items-center justify-center text-sm text-gray-400">
        No revenue history yet — add clients with start dates to build the trend.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <defs>
          <linearGradient id="momFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00250e" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#00250e" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: '#6b7280' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => formatAUDCompact(v)}
          tick={{ fontSize: 11, fill: '#6b7280' }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip
          formatter={(value: number, _name, item: any) => {
            const g = item?.payload?.growth
            const growthStr = g == null ? '' : `  (${g > 0 ? '+' : ''}${g.toFixed(1)}% MoM)`
            return [`${formatAUD(value)}${growthStr}`, 'Revenue']
          }}
          contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="#00250e"
          strokeWidth={2}
          fill="url(#momFill)"
          dot={{ r: 2.5, fill: '#00250e' }}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
