import type { ServiceType, FrequencyType, DocumentStatus, DocumentType, HealthStatus, LeadStatus } from '@/types/app'

// Extended service type that includes local-only types not yet in the DB enum
export type ExtendedServiceType = ServiceType | 'carpet_cleaning' | 'hygiene_bins'

export const SERVICE_TYPE_LABELS: Record<ExtendedServiceType, string> = {
  general_cleaning:  'General Cleaning',
  pressure_washing:  'Pressure Washing',
  window_cleaning:   'Window Cleaning',
  floor_care:        'Floor Care',
  carpet_cleaning:   'Carpet Cleaning',
  hygiene_bins:      'Hygiene Bins',
}

export const SERVICE_TYPE_COLORS: Record<ExtendedServiceType, string> = {
  general_cleaning:  'bg-blue-50 text-blue-600 border border-blue-100',
  pressure_washing:  'bg-cyan-50 text-cyan-700 border border-cyan-100',
  window_cleaning:   'bg-sky-50 text-sky-700 border border-sky-100',
  floor_care:        'bg-amber-50 text-amber-700 border border-amber-100',
  carpet_cleaning:   'bg-purple-50 text-purple-700 border border-purple-100',
  hygiene_bins:      'bg-green-50 text-green-700 border border-green-100',
}

export const FREQUENCY_LABELS: Record<FrequencyType, string> = {
  daily:        'Daily',
  weekly:       'Weekly',
  fortnightly:  'Fortnightly',
  monthly:      'Monthly',
  quarterly:    'Quarterly',
  annual:       'Annual',
  one_off:      'One-Off',
}

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  draft:     'Draft',
  sent:      'Sent',
  signed:    'Signed',
  expired:   'Expired',
  cancelled: 'Cancelled',
}

export const DOCUMENT_STATUS_COLORS: Record<DocumentStatus, string> = {
  draft:     'bg-gray-100 text-gray-500 border border-gray-200',
  sent:      'bg-blue-50 text-blue-600 border border-blue-100',
  signed:    'bg-emerald-50 text-emerald-700 border border-emerald-100',
  expired:   'bg-orange-50 text-orange-600 border border-orange-100',
  cancelled: 'bg-red-50 text-red-600 border border-red-100',
}

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  proposal:             'Proposal',
  cleaning_agreement:   'Cleaning Agreement',
  specialist_agreement: 'Specialist Agreement',
}

// ─── Health status ────────────────────────────────────────────────────────────

export const HEALTH_STATUS_LABELS: Record<HealthStatus, string> = {
  healthy:    'Healthy',
  watch:      'Watch',
  at_risk:    'At Risk',
  incomplete: 'Incomplete',
}

export const HEALTH_STATUS_COLORS: Record<HealthStatus, string> = {
  healthy:    'bg-emerald-50 text-emerald-700',
  watch:      'bg-amber-50 text-amber-700',
  at_risk:    'bg-red-50 text-red-600',
  incomplete: 'bg-gray-100 text-gray-500',
}

export const HEALTH_STATUS_DOT: Record<HealthStatus, string> = {
  healthy:    'bg-emerald-500',
  watch:      'bg-amber-500',
  at_risk:    'bg-red-500',
  incomplete: 'bg-gray-400',
}

// ─── Margin thresholds (defaults — overridable in Settings) ───────────────────

export const DEFAULT_MARGIN_THRESHOLDS = {
  red:    24, // below this → critical
  yellow: 40, // below this → watch
}

export function getMarginColor(pct: number | null | undefined): string {
  if (pct == null) return 'text-gray-400'
  if (pct < DEFAULT_MARGIN_THRESHOLDS.red)    return 'text-red-600'
  if (pct < DEFAULT_MARGIN_THRESHOLDS.yellow)  return 'text-amber-600'
  return 'text-emerald-600'
}

export function getMarginBgColor(pct: number | null | undefined): string {
  if (pct == null) return 'bg-gray-50'
  if (pct < DEFAULT_MARGIN_THRESHOLDS.red)    return 'bg-red-50'
  if (pct < DEFAULT_MARGIN_THRESHOLDS.yellow)  return 'bg-amber-50'
  return 'bg-emerald-50'
}

// ─── Lead pipeline ────────────────────────────────────────────────────────────

export const LEAD_STATUS_LABELS: Record<string, string> = {
  lead:           'New Lead',
  contacted:      'Contacted',
  quoted:         'Quoted',
  proposal_sent:  'Proposal Sent',
  agreement_sent: 'Agreement Sent',
  won:            'Won',
  lost:           'Lost',
}

export const LEAD_STATUS_COLORS: Record<string, string> = {
  lead:           'bg-gray-100 text-gray-500 border border-gray-200',
  contacted:      'bg-blue-50 text-blue-600 border border-blue-100',
  quoted:         'bg-amber-50 text-amber-700 border border-amber-100',
  proposal_sent:  'bg-purple-50 text-purple-700 border border-purple-100',
  agreement_sent: 'bg-indigo-50 text-indigo-700 border border-indigo-100',
  won:            'bg-emerald-50 text-emerald-700 border border-emerald-100',
  lost:           'bg-red-50 text-red-600 border border-red-100',
}

export const LEAD_STATUS_OPTIONS: LeadStatus[] = ['lead', 'contacted', 'quoted', 'won', 'lost']

// ─── Misc ─────────────────────────────────────────────────────────────────────

export const SOP_CATEGORIES = [
  'General Cleaning',
  'Floor Care',
  'Pressure Washing',
  'Window Cleaning',
  'Onboarding',
  'Safety',
] as const

export type SOPCategory = (typeof SOP_CATEGORIES)[number]

export const EXPENSE_CATEGORIES = [
  'Supplies',
  'Equipment',
  'Fuel',
  'Admin',
  'Insurance',
  'Marketing',
  'Subcontractor',
  'Other',
] as const

export const VALUATION_MULTIPLE = 2.5
export const STATE_OPTIONS = ['QLD', 'NSW', 'VIC', 'SA', 'WA', 'TAS', 'NT', 'ACT']
export const SPECIALIST_SUBTYPES = ['Pressure Washing', 'Window Cleaning', 'Floor Care'] as const
