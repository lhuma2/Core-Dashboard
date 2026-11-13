// Commercial client surveys: emailed every 2 months when Laith presses Send, five 1 to 10 ratings and a notes box.
// The rules and words are the mock-up's (v76, v78). Shared by the hub pages, the actions and the public survey page.

import { addMonths, currentStatus } from './figures'

export const SV_Q = [
  { k: 'comm', label: 'Communication', q: 'How easy is it to reach us, and how well do we keep you in the loop?' },
  { k: 'qual', label: 'Cleaning quality', q: 'How happy are you with the standard of cleaning?' },
  { k: 'rel', label: 'Reliability', q: 'How consistent are we, turning up on time and doing every clean to the same standard?' },
  { k: 'value', label: 'Value for money', q: 'How would you rate the value you get for what you pay?' },
  { k: 'rec', label: 'Would recommend', q: 'How likely are you to recommend Core Cleaning to another business?' },
] as const
export type SvKey = (typeof SV_Q)[number]['k']
export type SvScores = Record<SvKey, number>

export interface SvClient {
  id: string; name: string; email: string; contact: string
  status: string; resumeOn: string | null; off: boolean; snooze: string | null; firstClean: string | null
}
export interface SvRec {
  id: string; clientId: string; client: string; sentAt: string; sentTo: string; remindedAt: string | null
  answeredAt: string | null; scores: SvScores | null; notes: string; followedAt: string | null; followNote: string
}

export const svAvg = (x: { scores: SvScores | null } | null) => {
  if (!x || !x.scores) return 0
  const t = SV_Q.reduce((s, q) => s + (+x.scores![q.k] || 0), 0)
  return Math.round((t / SV_Q.length) * 10) / 10
}
export const svFmt = (n: number) => (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, '')
export const svLow = (x: { scores: SvScores | null } | null) => !!(x && x.scores) && SV_Q.some(q => (+x.scores![q.k] || 0) <= 6)
export const svFlag = (x: SvRec) => !!x.answeredAt && !x.followedAt && svLow(x)
export const svCls = (v: number) => (v <= 6 ? 'svs low' : v <= 8 ? 'svs mid' : 'svs good')
export const svPoss = (n: string) => (/s$/i.test(n) ? n + '’' : n + '’s')
export const svFirstName = (contact: string) => (contact ? contact.replace(/^(Dr|Mr|Mrs|Ms|Miss)\.? /, '').split(' ')[0] : '') || 'there'
export const svStatus = (c: SvClient, today: string) => currentStatus({ status: c.status, resume_on: c.resumeOn }, today)

/** This client's surveys, newest sent first. */
export const svOf = (list: SvRec[], clientId: string) =>
  list.filter(x => x.clientId === clientId).sort((a, b) => b.sentAt.localeCompare(a.sentAt) || b.id.localeCompare(a.id))
export const svWaitOf = (list: SvRec[], clientId: string) => svOf(list, clientId).find(x => !x.answeredAt) || null

/** When the next survey comes up to send: 2 months after the last one went out, or 2 months after the first clean
 *  for a new client (no first clean date = nothing due). Paused clients wait for their resume date; Remind me in
 *  2 weeks pushes it to the snooze date. '' = nothing due yet. */
export function svBase(c: SvClient, list: SvRec[], today: string): string {
  const last = svOf(list, c.id)[0]
  const f = c.firstClean || ''
  if (!last && !/^\d{4}-\d{2}-\d{2}$/.test(f)) return ''
  let base = last ? addMonths(last.sentAt, 2) : addMonths(f, 2)
  if (svStatus(c, today) === 'paused' && c.resumeOn && base < c.resumeOn) base = c.resumeOn
  if (c.snooze && base < c.snooze && (!last || last.sentAt < c.snooze)) base = c.snooze
  return base
}
export function svNext(c: SvClient, list: SvRec[], today: string): string {
  if (c.off) return ''
  const b = svBase(c, list, today)
  return !b ? '' : b < today ? today : b
}
export function svDue(c: SvClient, list: SvRec[], today: string): boolean {
  const b = svBase(c, list, today)
  return !!b && !c.off && svStatus(c, today) === 'active' && !svWaitOf(list, c.id) && b <= today
}

/** Score check for the survey page: the labels still to rate, in order. */
export function svMissing(a: Partial<Record<string, unknown>>): string[] {
  return SV_Q.filter(q => { const v = Number(a[q.k]); return !(Number.isInteger(v) && v >= 1 && v <= 10) }).map(q => q.label)
}
