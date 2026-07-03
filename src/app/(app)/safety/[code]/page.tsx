import { notFound } from 'next/navigation'
import { findSwms, findPolicy } from '@/lib/documents/safety'
import { SafetyPrint } from '@/components/documents/SafetyPrint'

export default function SafetyDocPage({ params }: { params: { code: string } }) {
  if (params.code === 'modern-slavery') return <SafetyPrint />
  if (params.code === 'sds-register') return <SafetyPrint sds />
  const policy = findPolicy(params.code)
  if (policy) return <SafetyPrint policy={policy} />
  const swms = findSwms(params.code)
  if (!swms) notFound()
  return <SafetyPrint swms={swms} />
}
