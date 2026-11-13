// Client portal: shapes and the request types, word for word from the mock-up (Client.dc.html).

export interface PortalSite { id: string; name: string; address: string; days: string; time: string; team: string; extras: string; sow: { heading: string; items: string[] }[] }
export interface PortalClean { key: string; iso: string; start: string; day: string; date: string; site: string; siteId: string | null; time: string; sub: string; jobId?: string }
export interface PortalRequest { id: string; title: string; sub: string; reply: string; status: 'new' | 'replied' | 'done' }
export interface PortalDoc { title: string; sub: string; href: string }
export interface PortalData { sites: PortalSite[]; upcoming: PortalClean[]; recent: PortalClean[]; requests: PortalRequest[]; docs: PortalDoc[] }

export type RqKind = 'photos' | 'quote' | 'extra' | 'change' | 'supplies' | 'access' | 'problem' | 'other'
export interface RqDef { id: RqKind; label: string; sub: string; clean?: boolean; service?: boolean; site?: boolean; date?: 'opt' | 'req'; dateLabel?: string; textReq: boolean; textLabel: string; ph: string; note?: string }
export const RQ: RqDef[] = [
  { id: 'photos', label: 'Photos of a clean', sub: 'See the finished job', clean: true, textReq: false, textLabel: 'Anything in particular? (optional)', ph: 'e.g. The treatment rooms and bathrooms' },
  { id: 'quote', label: 'Quote for another service', sub: 'Windows, carpets, pressure washing and more', service: true, site: true, date: 'opt', dateLabel: 'When would suit? (optional)', textReq: true, textLabel: 'Tell us about the job', ph: 'e.g. Carpet steam clean in the waiting room, about 40 square metres' },
  { id: 'extra', label: 'An extra clean', sub: 'One-off, on top of your regular cleans', site: true, date: 'req', dateLabel: 'Which day?', textReq: false, textLabel: 'Anything we should know? (optional)', ph: 'e.g. We have an inspection that morning' },
  { id: 'change', label: 'Change my regular cleans', sub: 'Days, times or what’s included', site: true, textReq: true, textLabel: 'What would you like changed?', ph: 'e.g. Can the West wing be cleaned on Tuesdays instead of Mondays?' },
  { id: 'supplies', label: 'Supplies running low', sub: 'Toilet paper, soap, paper towel, bin liners', site: true, textReq: true, textLabel: 'What’s running low?', ph: 'e.g. Paper towel in both bathrooms' },
  { id: 'access', label: 'New keys, codes or access', sub: 'So your cleaners can still get in', site: true, textReq: true, textLabel: 'What’s changed?', ph: 'e.g. New alarm code from Monday', note: 'Only Laith and the cleaners on your site see this.' },
  { id: 'problem', label: 'Something wasn’t right', sub: 'We’ll fix it at the next clean', clean: true, textReq: true, textLabel: 'What wasn’t right?', ph: 'e.g. Bins in consult room 2 weren’t emptied' },
  { id: 'other', label: 'Something else', sub: 'Anything we can help with', site: true, textReq: true, textLabel: 'How can we help?', ph: 'Tell us what you need' },
]
export const RQ_SERVICES = ['Window cleaning', 'Carpet steam clean', 'Pressure washing', 'Vinyl strip and seal', 'Upholstery cleaning', 'Something else']
export const rqDef = (k: string) => RQ.find(x => x.id === k)

export const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DFULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const parts = (iso: string) => iso.split('-').map(Number)
const dow = (iso: string) => { const [y, m, d] = parts(iso); return new Date(Date.UTC(y, m - 1, d)).getUTCDay() }
export const pShort = (iso: string) => { const p = parts(iso); return p[2] + ' ' + MON[p[1] - 1].slice(0, 3) }
export const pLong = (iso: string) => { const p = parts(iso); return DFULL[dow(iso)] + ' ' + p[2] + ' ' + MON[p[1] - 1] }
export const pDay = (iso: string) => DN[dow(iso)]
/** 18:00 → 6pm, 18:30 → 6:30pm */
export function p12(t: string): string {
  if (!/^\d{2}:\d{2}/.test(t || '')) return ''
  let h = parseInt(t.slice(0, 2), 10); const m = t.slice(3, 5), ap = h >= 12 ? 'pm' : 'am'
  h = h % 12 || 12
  return h + (m === '00' ? '' : ':' + m) + ap
}

/** Password rules: 8+ characters, not their first name, both boxes match. Same words as the cleaner app. */
export function pwCheck(a: string, b: string, first: string): string {
  if (a.length < 8) return 'Use at least 8 characters.'
  if (a.length > 72) return 'That’s too long. Use 72 characters or fewer.'
  if (first && a.toLowerCase().includes(first.toLowerCase())) return 'Don’t use your first name in your password.'
  if (a !== b) return 'The two passwords don’t match.'
  return ''
}
/** "Dr Helen Park" → "Helen" (titles dropped). */
export function clientFirst(name: string): string {
  const p = String(name || '').trim().split(/\s+/).filter(w => !/^(dr|mr|mrs|ms|miss|prof)\.?$/i.test(w))
  return p[0] || ''
}
