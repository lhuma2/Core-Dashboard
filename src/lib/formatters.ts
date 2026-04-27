import { format, parseISO, differenceInMonths } from 'date-fns'

/**
 * Format a date as DD/MM/YYYY (Australian standard)
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  try {
    const d = typeof date === 'string' ? parseISO(date) : date
    return format(d, 'dd/MM/yyyy')
  } catch {
    return '—'
  }
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—'
  try {
    const d = typeof date === 'string' ? parseISO(date) : date
    return format(d, 'dd/MM/yyyy h:mm a')
  } catch {
    return '—'
  }
}

export function formatMonthYear(date: string | Date | null | undefined): string {
  if (!date) return '—'
  try {
    const d = typeof date === 'string' ? parseISO(date) : date
    return format(d, 'MMM yyyy')
  } catch {
    return '—'
  }
}

/**
 * Format as AUD currency (e.g. $1,250.00)
 */
export function formatAUD(value: number | null | undefined): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
  }).format(value)
}

/**
 * Format as compact AUD (e.g. $1.2k)
 */
export function formatAUDCompact(value: number | null | undefined): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

/**
 * Calculate tenure in months from a start date
 */
export function tenureMonths(startDate: string | null | undefined): number {
  if (!startDate) return 0
  try {
    return differenceInMonths(new Date(), parseISO(startDate))
  } catch {
    return 0
  }
}

export function formatTenure(startDate: string | null | undefined): string {
  const months = tenureMonths(startDate)
  if (months < 1) return 'Less than 1 month'
  if (months < 12) return `${months} month${months === 1 ? '' : 's'}`
  const years = Math.floor(months / 12)
  const rem = months % 12
  const yearStr = `${years} year${years === 1 ? '' : 's'}`
  return rem > 0 ? `${yearStr}, ${rem} month${rem === 1 ? '' : 's'}` : yearStr
}

/**
 * Convert ISO date string to yyyy-MM-dd for input[type=date]
 */
export function toInputDate(date: string | null | undefined): string {
  if (!date) return ''
  try {
    return format(parseISO(date), 'yyyy-MM-dd')
  } catch {
    return ''
  }
}
