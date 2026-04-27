'use client'

import { ResponsiveContainer } from 'recharts'

interface ChartContainerProps {
  height?: number
  children: React.ReactNode
}

export function ChartContainer({ height = 300, children }: ChartContainerProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      {children as React.ReactElement}
    </ResponsiveContainer>
  )
}
