// Follow-up calls on sent quotes.
//
// The owner has usually already called the client before sending the quote, so
// the first follow-up is the day after it goes out. Each logged call schedules
// the next one, spaced further apart: day 1, 3, 7 and 14 after sending if every
// call is made on the day. After the last one the quote stops asking.

import { fieldValue, isChanged, isTemplateDocData } from './template'

/** Days to wait before each follow-up call, counted from the previous call (or the send). */
export const FOLLOW_UP_GAPS = [1, 2, 4, 7]

export type FollowUpOutcome = 'spoke' | 'no_answer' | 'not_going_ahead'

export const FOLLOW_UP_OUTCOME_LABELS: Record<FollowUpOutcome, string> = {
  spoke: 'Spoke to them',
  no_answer: 'No answer / left a message',
  not_going_ahead: 'Not going ahead',
}

export interface FollowUpData {
  log: { at: string; outcome: FollowUpOutcome }[]
  phone?: string          // typed in when the quote itself has no number
}

/** Quotes still waiting on the client: these get follow-up calls. */
export const FOLLOW_UP_STATUSES = ['sent', 'out_for_signature']

/** A date as YYYY-MM-DD in Brisbane. */
export function brisbaneDate(d: Date | string = new Date()): string {
  return new Date(d).toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' })
}

function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** "2026-10-16" → "Thu 16 Oct". */
export function shortDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 2)).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}

export interface FollowUpState {
  step: number            // 1-based number of the next call
  total: number
  dueDate: string | null  // YYYY-MM-DD; null once there are no more calls to make
  due: boolean            // due today or overdue
  last?: { at: string; outcome: FollowUpOutcome }
}

export function followUpState(doc: { status: string; sent_at: string | null; data: any }, today = brisbaneDate()): FollowUpState | null {
  if (!doc.sent_at || !FOLLOW_UP_STATUSES.includes(doc.status)) return null
  const log: FollowUpData['log'] = Array.isArray(doc.data?.followUps?.log) ? doc.data.followUps.log : []
  const last = log[log.length - 1]
  const total = FOLLOW_UP_GAPS.length
  if (last?.outcome === 'not_going_ahead' || log.length >= total) return { step: log.length, total, dueDate: null, due: false, last }
  const from = brisbaneDate(last?.at ?? doc.sent_at)
  const dueDate = addDays(from, FOLLOW_UP_GAPS[log.length])
  return { step: log.length + 1, total, dueDate, due: dueDate <= today, last }
}

/** The client's phone number from the quote: typed in for follow-ups, the website request, or a phone field. */
export function quotePhone(data: any): string {
  const typed = data?.followUps?.phone?.trim()
  if (typed) return typed
  const fromRequest = data?.quoteRequest?.phone?.trim()
  if (fromRequest) return fromRequest
  if (isTemplateDocData(data)) {
    for (const f of data.template.fields) {
      if (f.kind !== 'text' || !/phone|mobile|contact number/i.test(f.label)) continue
      const v = fieldValue(f, data.values)
      // The template's own placeholder (often Core Cleaning's number) isn't the client's.
      if (isChanged(f, v) && /\d{6,}/.test(v.replace(/\D/g, ''))) return v.trim()
    }
  }
  return ''
}

/** A tel: link for an Australian number, e.g. "0407 026 360" → "tel:0407026360". */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}
