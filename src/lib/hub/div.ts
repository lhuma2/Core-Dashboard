// Residential and End of Lease share the same screens; each keeps its own clients, quotes and agreements.
export type Div = 'res' | 'eol'
export const SLUG: Record<Div, string> = { res: 'residential', eol: 'end-of-lease' }
export const DIVN: Record<Div, string> = { res: 'Residential', eol: 'End of Lease' }
export const AGRN: Record<Div, string> = { res: 'Residential service agreement', eol: 'End of lease service agreement' }
export const divBase = (d: Div) => '/hub/' + SLUG[d]
export function divFromSlug(s?: string | null): Div | null { return s === 'residential' ? 'res' : s === 'end-of-lease' ? 'eol' : null }
/** From a path such as /hub/end-of-lease/clients/… */
export function divFromPath(p?: string | null): Div { return divFromSlug((p || '').split('/')[2]) || 'res' }
export const asDiv = (v: unknown): Div => (v === 'eol' ? 'eol' : 'res')
