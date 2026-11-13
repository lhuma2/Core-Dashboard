'use server'

// "Upload a scope" on the proposal form: Laith uploads a client's scope of works (PDF or photo), and Claude Haiku reads
// it into headed task lists that drop straight into the proposal's scope editor. Same model and approach as the other
// extraction routes (claude-haiku-4-5, JSON enforced with output_config.format, no prompt caching).

import { createAdminClient } from '@/lib/supabase/admin'
import { requireStaff } from '@/lib/require-staff'

const BUCKET = 'client-files'
const OFFLINE = 'The upload didn’t go through. Check your connection and try again.'
const UNREADABLE = 'We couldn’t read a scope from that file. Try a clearer copy, or tick the presets and type the tasks in.'
const KINDS: Record<string, { ext: string; block: 'document' | 'image' }> = {
  'application/pdf': { ext: 'pdf', block: 'document' },
  'image/jpeg': { ext: 'jpg', block: 'image' },
  'image/png': { ext: 'png', block: 'image' },
  'image/webp': { ext: 'webp', block: 'image' },
  'image/gif': { ext: 'gif', block: 'image' },
}
const MAX = 20 * 1024 * 1024
const PATH = /^scopes\/[0-9]{8}-[0-9a-f]{12}\.(pdf|jpg|png|webp|gif)$/

/** A one-off upload link for the scope file. */
export async function scopeUploadUrl(type: string, size: number): Promise<{ ok: true; url: string; path: string } | { ok: false; error: string }> {
  const no = await requireStaff(); if (no) return { ok: false, error: no }
  const k = KINDS[String(type || '').toLowerCase()]
  if (!k) return { ok: false, error: 'Choose a PDF or a photo (JPG or PNG) of the scope. iPhone photos in HEIC: take a screenshot of it and upload that.' }
  if (!(size > 0) || size > MAX) return { ok: false, error: 'That file is too big. Choose one under 20 MB.' }
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const path = `scopes/${day}-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}.${k.ext}`
  const s = await createAdminClient().storage.from(BUCKET).createSignedUploadUrl(path, { upsert: true })
  if (s.error || !s.data?.signedUrl) return { ok: false, error: OFFLINE }
  return { ok: true, url: s.data.signedUrl, path }
}

const PROMPT = `This is a commercial cleaning scope of works from a client (an office, clinic, warehouse, body corporate or similar).
Read it into the cleaning tasks the client wants done, grouped under short headings by area or frequency, in the order they appear.

Rules:
- heading: a short area or frequency heading, e.g. "Kitchen", "Bathrooms", "Weekly", "Monthly". Use "General" if the scope has no headings.
- items: one task per item, in plain Australian English, starting with a verb where it reads naturally (e.g. "Vacuum all carpeted areas"). Keep the client's own wording otherwise; don't invent tasks.
- Leave out prices, contract terms, contact details, insurance and anything that isn't a cleaning task.
- If the file is not a cleaning scope, or has no readable tasks, return an empty groups list.`

const SCHEMA = {
  type: 'object',
  properties: {
    groups: {
      type: 'array',
      items: {
        type: 'object',
        properties: { heading: { type: 'string' }, items: { type: 'array', items: { type: 'string' } } },
        required: ['heading', 'items'],
        additionalProperties: false,
      },
    },
  },
  required: ['groups'],
  additionalProperties: false,
}

/** Reads the uploaded scope into headed task lists. */
export async function readScope(path: string, type: string): Promise<{ ok: true; sow: { heading: string; items: string[] }[] } | { ok: false; error: string }> {
  const no = await requireStaff(); if (no) return { ok: false, error: no }
  const k = KINDS[String(type || '').toLowerCase()]
  if (!k || !PATH.test(String(path || ''))) return { ok: false, error: UNREADABLE }
  const key = process.env.ANTHROPIC_API_KEY?.trim()
  if (!key) return { ok: false, error: 'Reading uploaded scopes isn’t switched on here (this is the test site). Tick the presets or type the tasks in instead.' }
  const dl = await createAdminClient().storage.from(BUCKET).download(path)
  if (dl.error || !dl.data) return { ok: false, error: OFFLINE }
  const data = Buffer.from(await dl.data.arrayBuffer()).toString('base64')
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 8000,
        output_config: { format: { type: 'json_schema', schema: SCHEMA } },
        messages: [{
          role: 'user',
          content: [
            { type: k.block, source: { type: 'base64', media_type: type.toLowerCase(), data } },
            { type: 'text', text: PROMPT },
          ],
        }],
      }),
    })
    if (!res.ok) { console.error('readScope: Claude API', res.status, await res.text().catch(() => '')); return { ok: false, error: UNREADABLE } }
    const out = await res.json()
    if (out.stop_reason === 'max_tokens' || out.stop_reason === 'refusal') return { ok: false, error: UNREADABLE }
    const text = (out.content || []).find((b: { type: string }) => b.type === 'text')?.text ?? ''
    const parsed = JSON.parse(text) as { groups: { heading: string; items: string[] }[] }
    const sow = parsed.groups
      .map(g => ({ heading: String(g.heading || '').trim().slice(0, 80) || 'General', items: g.items.map(t => String(t || '').trim().replace(/\s+/g, ' ').slice(0, 300)).filter(Boolean).slice(0, 60) }))
      .filter(g => g.items.length)
      .slice(0, 20)
    if (!sow.length) return { ok: false, error: UNREADABLE }
    return { ok: true, sow }
  } catch (e) {
    console.error('readScope failed', e)
    return { ok: false, error: UNREADABLE }
  }
}
