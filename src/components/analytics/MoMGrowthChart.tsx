'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { formatAUD } from '@/lib/formatters'

interface DataPoint {
  month: string
  revenue: number
  growth: number | null
}

interface MoMGrowthChartProps {
  data: DataPoint[]
}

export function MoMGrowthChart({ data }: MoMGrowthChartProps) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: '#6b7280' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => `${v > 0 ? '+' : ''}${v?.toFixed(0)}%`}
          tick={{ fontSize: 11, fill: '#6b7280' }}
          axisLine={false}
          tickLine={false}
          width={45}
        />
        <ReferenceLine y={0} stroke="#e5e7eb" strokeWidth={1} />
        <Tooltip
          formatter={(value: number) => [
            `${value > 0 ? '+' : ''}${value?.toFixed(1)}%`,
            'MoM Growth',
          ]}
          contentStyle={{
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            fontSize: '12px',
          }}
        />
        <Line
          type="monotone"
          dataKey="growth"
          stroke="#1e3a5f"
          strokeWidth={2}
          dot={{ r: 3, fill: '#1e3a5f' }}
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
