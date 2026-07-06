'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { formatAUD } from '@/lib/formatters'

interface DataPoint {
  month: string
  income: number
  expense: number
}

interface RevenueBarChartProps {
  data: DataPoint[]
}

export function RevenueBarChart({ data }: RevenueBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: '#6b7280' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
          tick={{ fontSize: 11, fill: '#6b7280' }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip
          formatter={(value: number, name: string) => [
            formatAUD(value),
            name === 'income' ? 'Income' : 'Expenses',
          ]}
          contentStyle={{
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            fontSize: '12px',
          }}
        />
        <Bar dataKey="income" fill="#00250e" radius={[4, 4, 0, 0]} name="income" />
        <Bar dataKey="expense" fill="#cbd5e1" radius={[4, 4, 0, 0]} name="expense" />
      </BarChart>
    </ResponsiveContainer>
  )
}
