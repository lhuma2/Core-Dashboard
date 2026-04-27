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
  general_cleaning:  'bg-blue-500/15 text-blue-400 border border-blue-500/20',
  pressure_washing:  'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20',
  window_cleaning:   'bg-sky-500/15 text-sky-400 border border-sky-500/20',
  floor_care:        'bg-amber-500/15 text-amber-400 border border-amber-500/20',
  carpet_cleaning:   'bg-purple-500/15 text-purple-400 border border-purple-500/20',
  hygiene_bins:      'bg-green-500/15 text-green-400 border border-green-500/20',
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
  draft:     'bg-slate-700 text-slate-300',
  sent:      'bg-blue-500/15 text-blue-400 border border-blue-500/20',
  signed:    'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
  expired:   'bg-orange-500/15 text-orange-400 border border-orange-500/20',
  cancelled: 'bg-red-500/15 text-red-400 border border-red-500/20',
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
  lead:           'bg-slate-700 text-slate-300',
  contacted:      'bg-blue-500/15 text-blue-400',
  quoted:         'bg-amber-500/15 text-amber-400',
  proposal_sent:  'bg-purple-500/15 text-purple-400',
  agreement_sent: 'bg-indigo-500/15 text-indigo-400',
  won:            'bg-emerald-500/15 text-emerald-400',
  lost:           'bg-red-500/15 text-red-400',
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
