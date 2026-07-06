// ─── BRAND CONTROL PANEL ─────────────────────────────────────────────────────
// White-labelling this hub? Change the values here first. This is the single
// source of truth for business identity. Anywhere the app still hardcodes a
// "Core Cleaning" value (see WHITE-LABEL.md for the file list), point it at BRAND.<x>.
//
// Nothing secret lives here — just public business details. Secrets go in .env
// (see .env.example). Legal documents (SWMS, policies, service agreement) are
// NOT branding: replace them with your own reviewed versions, don't just rename.

export const BRAND = {
  // Identity
  name:       'Core Cleaning',
  legalName:  'Core Cleaning',
  abn:        '',
  owner:      'Laith Humadi',
  ownerRole:  'Director',
  location:   'Brisbane, QLD',

  // Contact
  email:      'admin@corecleaning.services',
  phone:      '0407 026 360',
  website:    'corecleaning.services',
  websiteUrl: 'https://www.corecleaning.services',

  // Portal (must match your deployed domain — also set NEXT_PUBLIC_APP_URL)
  appUrl:     'https://portal.corecleaning.services',

  // Outbound email (the sending domain must be verified in Resend)
  emailFromName: 'Laith at Core Cleaning',
  emailFrom:     'Laith at Core Cleaning <admin@corecleaning.services>',
  replyTo:       'admin@corecleaning.services',

  // Compliance reference shown to clients (your own policy number)
  insurancePolicyNumber: '',

  // Brand colours
  colors: {
    ink:  '#0b1320', // darkest navy — sidebars, dark surfaces
    navy: '#1e3a5f', // primary accent — buttons, active states
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

export type Brand = typeof BRAND
