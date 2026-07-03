import { notFound } from 'next/navigation'
import { findSwms } from '@/lib/documents/safety'
import { SafetyPrint } from '@/components/documents/SafetyPrint'

export default function SafetyDocPage({ params }: { params: { code: string } }) {
  if (params.code === 'modern-slavery') return <SafetyPrint />
  const swms = findSwms(params.code)
  if (!swms) notFound()
  return <SafetyPrint swms={swms} />
}
