// Team: everyone on the team, from their cleaner login (signed the pack) or from the pack they were sent (not signed
// yet). Words from the mock-up (v80).
import { REGIONS } from './figures'

export type RegionId = (typeof REGIONS)[number]['id']
export const REGION_NAME: Record<string, string> = Object.fromEntries(REGIONS.map(r => [r.id, r.name]))
export const isRegion = (v: unknown): v is RegionId => REGIONS.some(r => r.id === v)

export interface SignedDetails { company: string; abn: string; contact: string; phone: string; insurer: string; policy: string; expiry: string; sig: string; date: string; cert: boolean }
export interface TeamMember {
  /** 'p' a cleaner login (profile id), 'k' a pack not signed yet (pack id) */
  kind: 'p' | 'k'; id: string; name: string; email: string; phone: string
  region: string | null; leader: boolean; signed: boolean
  /** the pack row, when they signed through the new hub (or were sent one) */
  packId: string | null; details: SignedDetails | null
}

/** "12345678901" → "12 345 678 901" */
export const abnFmt = (v: string) => v.replace(/\D/g, '').replace(/^(\d{2})(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3 $4')
/** "2027-03-31" → "31/03/2027" */
export const auDate = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : '')
export const fixedName = (x: string) => { const t = String(x || '').trim().replace(/\s+/g, ' '); return t.charAt(0).toUpperCase() + t.slice(1) }

/** The documents the signature covers: everything in the pack, as the old onboarding page listed them. Each opens
 *  the public copy, except the agreement and induction, which are on the signing page itself. */
export const PACK_DOCS: { code: string; title: string; href: string | null }[] = [
  { code: 'DCA-SUB', title: 'Subcontractor Services Agreement', href: null },
  { code: 'IND-001', title: 'Contractor Induction', href: null },
  ...[
    ['SWMS 001', 'Commercial Cleaning Operations'], ['SWMS 002', 'Chemical Handling & Storage'], ['SWMS 003', 'Manual Handling'],
    ['SWMS 004', 'Slip, Trip & Fall Prevention'], ['SWMS 005', 'Pressure Washing'], ['SWMS 006', 'Floor Scrubbing & Polishing'],
    ['SWMS 007', 'Window Cleaning'], ['SWMS 008', 'Bond Cleaning Operations'], ['SWMS 009', 'Residential Cleaning Operations'],
  ].map(([code, title]) => ({ code, title, href: '/compliance/' + code.replace(/\s+/g, '-').toLowerCase() })),
  { code: 'POL-002', title: 'Environmental Policy', href: '/compliance/environmental-policy' },
  { code: 'POL-003', title: 'Business Continuity Plan', href: '/compliance/business-continuity' },
  { code: 'POLICY', title: 'Modern Slavery Declaration', href: '/compliance/modern-slavery' },
  { code: 'SDS-REG', title: 'Safety Data Sheet (SDS) Register', href: '/compliance/sds-register' },
]

/** The starter password emailed when they sign: their first name, or with the year added when it's under 6 letters
 *  (the shortest password Supabase allows). They choose their own the first time they log in. */
export const starterPw = (first: string, year: number) => (first.length >= 6 ? first : first + year)
