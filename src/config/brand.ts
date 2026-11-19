// ─── BUSINESS DETAILS: THE ONE PLACE TO CHANGE THEM ──────────────────────────
// Every business name, ABN, ACN, email address, website and portal link the hub
// shows or sends comes from this file. Change them here, nowhere else.
//
// Two identities are kept on purpose:
//   SOLE_TRADER  – the business before it became a company. Quotes, proposals and
//                  agreements issued before SWITCH_OVER_DATE keep showing these.
//   COMPANY      – Core Cleaning QLD Pty Ltd. Used from SWITCH_OVER_DATE onward.
// So already-issued and signed documents never change when the details do.
//
// Going live with the company: fill in COMPANY (acn, abn) and set
// SWITCH_OVER_DATE ('YYYY-MM-DD').
//
// The domain (DOMAIN below) is separate from the ABN switch. To change it: verify
// it in Resend, add portal.<domain> in Vercel and in Supabase's auth redirect URLs.
//
// Nothing secret lives here. Secrets go in .env (see .env.example).

export interface Issuer {
  /** The name people know, e.g. on logos and greetings. */
  tradingName: string
  /** The registered legal name. Shown on documents as the party providing the service. */
  legalName:   string
  acn:         string
  abn:         string
  /** Main mailbox shown on documents. */
  email:       string
  /** Contact mailbox printed on compliance documents. */
  contactEmail: string
  phone:       string
  /** Bare website, e.g. corecleaning.services */
  website:     string
}

/** The business domain: website, email and portal. */
export const DOMAIN = 'corecleaningqld.com'

// Contact details (email, website) follow DOMAIN on every document, old or new,
// because the old corecleaning.services addresses forward to the new ones.
// Only the legal identity (name, ACN, ABN) is fixed by a document's date.
export const SOLE_TRADER: Issuer = {
  tradingName:  'Core Cleaning',
  legalName:    'Core Cleaning',
  acn:          '',
  abn:          '45 344 135 153',
  email:        `admin@${DOMAIN}`,
  contactEmail: `admin@${DOMAIN}`,
  phone:        '0407 026 360',
  website:      DOMAIN,
}

// Waiting on the ABN (ABR).
// Until SWITCH_OVER_DATE is set, nothing below is shown on documents.
export const COMPANY: Issuer = {
  tradingName:  'Core Cleaning',
  legalName:    'Core Cleaning QLD Pty Ltd',
  acn:          '704 290 737', // registered 19/11/2026
  abn:          '',
  email:        `admin@${DOMAIN}`,
  contactEmail: `admin@${DOMAIN}`,
  phone:        SOLE_TRADER.phone,
  website:      DOMAIN,
}

/** The hub mailbox on the current domain: sends hub email, receives replies. */
const HUB_EMAIL = `admin@${DOMAIN}`

/** First day (Brisbane time, YYYY-MM-DD) documents show the company. Empty = not switched yet. */
export const SWITCH_OVER_DATE: string = ''

function brisbaneIso(now: Date = new Date()): string {
  return new Date(now.getTime() + 10 * 3600_000).toISOString().slice(0, 10)
}

/** Who issued a document dated `dateIso` (YYYY-MM-DD or an ISO timestamp). No date = today. */
export function issuer(dateIso?: string | null): Issuer {
  if (!SWITCH_OVER_DATE) return SOLE_TRADER
  const d = /^\d{4}-\d{2}-\d{2}/.test(dateIso || '') ? String(dateIso).slice(0, 10) : brisbaneIso()
  return d >= SWITCH_OVER_DATE ? COMPANY : SOLE_TRADER
}

/** "ABN 45 344 135 153", or "ACN 123 456 789 · ABN 12 345 678 901" for the company. */
export function regNumbers(i: Issuer, sep = ' · '): string {
  return [i.acn && `ACN ${i.acn}`, i.abn && `ABN ${i.abn}`].filter(Boolean).join(sep)
}

/** "Core Cleaning, ABN 45 344 135 153" / "Core Cleaning QLD Pty Ltd, ACN …, ABN …" */
export function partyLine(i: Issuer): string {
  const n = regNumbers(i, ', ')
  return n ? `${i.legalName}, ${n}` : i.legalName
}

/** "Core Cleaning (ABN 45 344 135 153)" / "Core Cleaning QLD Pty Ltd (ACN …, ABN …)" */
export function partyParen(i: Issuer): string {
  const n = regNumbers(i, ', ')
  return n ? `${i.legalName} (${n})` : i.legalName
}

const CURRENT = issuer()

export const BRAND = {
  // Identity (today's issuer; documents should call issuer(date) instead)
  name:       CURRENT.tradingName,
  legalName:  CURRENT.legalName,
  abn:        CURRENT.abn,
  acn:        CURRENT.acn,
  owner:      'Laith Humadi',
  ownerRole:  'Director',
  location:   'Brisbane, QLD',

  // Contact
  email:        HUB_EMAIL,
  contactEmail: HUB_EMAIL,
  phone:        CURRENT.phone,
  phoneIntl:    '+61 407 026 360',
  website:      DOMAIN,
  websiteUrl:   `https://www.${DOMAIN}`,

  // Portal (must match the deployed domain; NEXT_PUBLIC_APP_URL wins when set)
  appUrl:     `https://portal.${DOMAIN}`,
  portalHost: `portal.${DOMAIN}`,

  // Outbound email (the sending domain must be verified in Resend)
  mailDomain:    DOMAIN,
  emailFromName: 'Laith at Core Cleaning',
  emailFrom:     `Laith at Core Cleaning <${HUB_EMAIL}>`,
  emailFromBiz:  `Core Cleaning <${HUB_EMAIL}>`,
  emailFromLaith: `Laith Humadi <${HUB_EMAIL}>`,
  emailFromHub:  `Core Cleaning Hub <${HUB_EMAIL}>`,
  replyTo:       HUB_EMAIL,

  // Compliance reference shown to clients (your own policy number)
  insurancePolicyNumber: '',

  // Brand colours
  colors: {
    ink:  '#00250e', // darkest navy — sidebars, dark surfaces
    navy: '#00250e', // primary accent — buttons, active states
  },

  // Logo assets in /public — replace the files, keep the paths (or update here)
  logos: {
    markWhite:     '/logo-mark-white.png',
    logoWhite:     '/logo-white.png',
    logoBlack:     '/logo-black.png',
    wordmarkWhite: '/proposal-assets/wordmark-white.png',
    wordmarkBlack: '/proposal-assets/wordmark-black.png',
    favicon:       '/favicon.png',
  },
} as const

/** The portal's base URL, no trailing slash. */
export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || BRAND.appUrl).replace(/\/$/, '')
}

export type Brand = typeof BRAND
