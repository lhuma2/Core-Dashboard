// Shared by the signing, quote and welcome flows (server-only helpers).

// The client-facing links MUST use the branded public domain — never a bare
// *.vercel.app alias (which may 404 or sit behind Vercel auth).
export const APP_URL = 'https://portal.corecleaning.services'
export const OWNER_EMAIL = 'admin@corecleaning.services'
export const WORDMARK = `${APP_URL}/proposal-assets/wordmark-white.png`
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

// Unambiguous lowercase alphabet (no 0/o/1/l/i) for the random suffix.
const CODE_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz'

/** Display date like "3 July 2026" in Brisbane time. */
export function auDate(iso?: string): string {
  return new Date(iso ?? Date.now()).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Brisbane',
  })
}

/** Friendly, unguessable link code, e.g. "northpoint-commercial-k7m2qp". */
export function makeSignCode(clientName: string): string {
  const slug = (clientName || 'agreement')
    .toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '')
    .trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 24).replace(/-$/, '')
  let rand = ''
  for (let i = 0; i < 6; i++) rand += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  return `${slug || 'agreement'}-${rand}`
}

/** Generate a code not already used in `table.column` (collisions are near-impossible; retry to be safe). */
export async function uniqueSignCode(db: any, clientName: string, table = 'proposal_documents', column = 'sign_code'): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeSignCode(clientName)
    const { data: clash } = await db.from(table).select('id').eq(column, code).maybeSingle()
    if (!clash) return code
  }
  return `${makeSignCode(clientName)}-${Date.now().toString(36)}`
}

/** Escape text going into an HTML email. */
export function esc(s: string | null | undefined): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
