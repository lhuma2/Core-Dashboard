// Commercial → Requests: what clients send from their portal. Words from the mock-up (v52).
import { isoDow } from './timetable'
import { dShort } from './home-quotes'

export interface HubRequest {
  id: string; clientId: string; client: string; kind: string; service: string; site: string; cleanDate: string | null; wantDate: string | null
  created: string; detail: string; reply: string; repliedAt: string | null; status: 'new' | 'replied' | 'done'
  booked: { date: string; start: string } | null
  /** For Book it: the site's usual start time, price and cleaners */
  svc: { id: string; start: string; price: number; cleaners: string[] } | null
  /** The specialist quote made from this request (Start quote), if any */
  prop?: { id: string; ref: string; status: string; sentAt: string | null; acceptedAt: string | null; revisionNote: string; reason: string; worksDate: string | null } | null
}
/** "Proposal CC-2026-CCQ043, sent 12 Nov 2026" under the request (mock-up wording). */
export function rqPropLine(p: NonNullable<HubRequest['prop']>): string {
  return 'Proposal ' + p.ref + (p.status === 'draft' ? ', draft not sent yet' : p.status === 'sent' ? ', sent ' + dShort(p.sentAt || '')
    : p.status === 'accepted' ? ', accepted ' + dShort(p.acceptedAt || '') + (p.worksDate ? ', works booked for ' + rqDay(p.worksDate) : '')
      : p.status === 'revision' ? ', they asked for changes: “' + p.revisionNote + '”' : ', declined' + (p.reason ? ': ' + p.reason.toLowerCase() : ''))
}
export const RQ_LABEL: Record<string, string> = { photos: 'Photos of a clean', quote: 'Quote', extra: 'Extra clean', change: 'Change regular cleans', supplies: 'Supplies running low', access: 'New keys or access', problem: 'Something wasn’t right', other: 'Something else' }
const DOW3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const rqDay = (iso?: string | null) => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? DOW3[isoDow(iso)] + ' ' + dShort(iso).replace(/ \d{4}$/, '') : '')
export function rqAge(iso: string, today: string): string {
  const p = iso.split('-'), q = today.split('-')
  const n = Math.round((Date.UTC(+q[0], +q[1] - 1, +q[2]) - Date.UTC(+p[0], +p[1] - 1, +p[2])) / 86400000)
  return n <= 0 ? 'today' : n === 1 ? 'yesterday' : n + ' days ago'
}
export const rqTitle = (r: { kind: string; service: string }) => (r.kind === 'quote' ? 'Quote: ' + (r.service || 'another service') : RQ_LABEL[r.kind] || 'Request')
export type RqKey = 'done' | 'booked' | 'replied' | 'new'
export function rqState(r: HubRequest): { key: RqKey; tag: string; tagCls: string } {
  if (r.status === 'done') return { key: 'done', tag: 'Done', tagCls: 'tag wt' }
  if (r.booked) return { key: 'booked', tag: 'Booked for ' + rqDay(r.booked.date), tagCls: 'tag wt' }
  if (r.reply) return { key: 'replied', tag: 'Replied', tagCls: 'tag sent' }
  return { key: 'new', tag: 'New', tagCls: 'tag warn' }
}
export const rqNeedsYou = (r: HubRequest) => rqState(r).key === 'new'
/** "Angela", "Angela and Joan" */
export const names = (a: string[]) => (a.length <= 1 ? a[0] || '' : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1])
