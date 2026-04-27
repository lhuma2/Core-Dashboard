import { cn } from '@/lib/utils'
import type { DocumentStatus, ServiceType } from '@/types/app'
import { SERVICE_TYPE_COLORS, SERVICE_TYPE_LABELS } from '@/lib/constants'

const STATUS_STYLES: Record<string, string> = {
  // Document statuses
  draft:     'bg-gray-100 text-gray-500 border border-gray-200',
  sent:      'bg-blue-50 text-blue-600 border border-blue-100',
  signed:    'bg-emerald-50 text-emerald-700 border border-emerald-100',
  expired:   'bg-orange-50 text-orange-600 border border-orange-100',
  cancelled: 'bg-red-50 text-red-600 border border-red-100',
  // Lead statuses
  lead:           'bg-gray-100 text-gray-500 border border-gray-200',
  contacted:      'bg-blue-50 text-blue-600 border border-blue-100',
  quoted:         'bg-amber-50 text-amber-700 border border-amber-100',
  proposal_sent:  'bg-purple-50 text-purple-700 border border-purple-100',
  agreement_sent: 'bg-indigo-50 text-indigo-700 border border-indigo-100',
  won:            'bg-emerald-50 text-emerald-700 border border-emerald-100',
  lost:           'bg-red-50 text-red-600 border border-red-100',
}

interface BadgeProps {
  children?: React.ReactNode
  status?: string
  label?: string
  className?: string
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
}

export function Badge({ children, status, label, className, variant }: BadgeProps) {
  const variantStyles: Record<string, string> = {
    default:  'bg-gray-100 text-gray-500 border border-gray-200',
    neutral:  'bg-gray-100 text-gray-500 border border-gray-200',
    success:  'bg-emerald-50 text-emerald-700 border border-emerald-100',
    warning:  'bg-amber-50 text-amber-700 border border-amber-100',
    danger:   'bg-red-50 text-red-600 border border-red-100',
    info:     'bg-blue-50 text-blue-600 border border-blue-100',
  }

  const resolvedStyle = status
    ? (STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-500 border border-gray-200')
    : variant
    ? (variantStyles[variant] ?? variantStyles.default)
    : variantStyles.default

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        resolvedStyle,
        className
      )}
    >
      {label ?? children ?? status}
    </span>
  )
}

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  const labels: Record<DocumentStatus, string> = {
    draft: 'Draft', sent: 'Sent', signed: 'Signed', expired: 'Expired', cancelled: 'Cancelled',
  }
  return <Badge status={status} label={labels[status]} />
}

export function LeadStatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    lead: 'New Lead', contacted: 'Contacted', quoted: 'Quoted',
    proposal_sent: 'Proposal Sent', agreement_sent: 'Agreement Sent',
    won: 'Won', lost: 'Lost',
  }
  return <Badge status={status} label={labels[status] ?? status} />
}

export function ServiceTypeBadge({ type }: { type: ServiceType }) {
  const darkStyles: Record<ServiceType, string> = {
    general_cleaning: 'bg-blue-50 text-blue-600 border border-blue-100',
    pressure_washing: 'bg-cyan-50 text-cyan-700 border border-cyan-100',
    window_cleaning:  'bg-sky-50 text-sky-700 border border-sky-100',
    floor_care:       'bg-amber-50 text-amber-700 border border-amber-100',
  }
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', darkStyles[type])}>
      {SERVICE_TYPE_LABELS[type]}
    </span>
  )
}

export function ActiveBadge({ active }: { active: boolean | null }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        active
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
          : 'bg-gray-100 text-gray-500 border border-gray-200'
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full mr-1.5', active ? 'bg-emerald-500' : 'bg-gray-400')} />
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}
