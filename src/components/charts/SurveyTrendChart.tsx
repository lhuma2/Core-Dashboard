'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { formatDate } from '@/lib/formatters'

interface DataPoint {
  date: string
  quality: number | null
  reliability: number | null
  communication: number | null
  value: number | null
}

interface SurveyTrendChartProps {
  data: DataPoint[]
}

export function SurveyTrendChart({ data }: SurveyTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tickFormatter={(v) => formatDate(v)}
          tick={{ fontSize: 11, fill: '#6b7280' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 10]}
          ticks={[0, 2, 4, 6, 7, 8, 10]}
          tick={{ fontSize: 11, fill: '#6b7280' }}
          axisLine={false}
          tickLine={false}
          width={25}
        />
        <ReferenceLine y={7} stroke="#fca5a5" strokeDasharray="4 4" label={{ value: 'At-risk threshold', fontSize: 10, fill: '#ef4444', position: 'right' }} />
        <Tooltip
          contentStyle={{
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            fontSize: '12px',
          }}
        />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
        <Line type="monotone" dataKey="quality" stroke="#1e3a5f" strokeWidth={2} dot={{ r: 3 }} name="Quality" connectNulls />
        <Line type="monotone" dataKey="reliability" stroke="#2a4f80" strokeWidth={2} dot={{ r: 3 }} name="Reliability" connectNulls />
        <Line type="monotone" dataKey="communication" stroke="#4a7ab5" strokeWidth={2} dot={{ r: 3 }} name="Communication" connectNulls />
        <Line type="monotone" dataKey="value" stroke="#6b9fd4" strokeWidth={2} dot={{ r: 3 }} name="Value" connectNulls />
      </LineChart>
    </ResponsiveContainer>
  )
}
