// Preview builds (every branch except master) must never touch the live
// database or send real email. On Vercel "preview" builds we swap in the
// separate test database (PREVIEW_* settings) and switch email sending off.
// If the test settings are missing, the build stops rather than fall back
// to the live database.
const isPreview = process.env.VERCEL_ENV === 'preview'

// Reads the Supabase project id baked into a key, so we can check that the
// address and both keys all belong to the same (test) project.
function projectRef(key) {
  try {
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString())
    return payload.ref || null
  } catch {
    return null
  }
}

// Settings pasted into Vercel often carry stray spaces or quotes, or leave off https://.
function clean(v) {
  return (v || '').trim().replace(/^["']|["']$/g, '').trim()
}
function cleanUrl(v) {
  let u = clean(v).replace(/\/+$/, '')
  if (!u) return ''
  if (/^[a-z0-9]{20}$/.test(u)) u = `https://${u}.supabase.co`
  if (!/^https?:\/\//.test(u)) u = `https://${u}`
  return u
}

let previewEnv = {}
if (isPreview) {
  // The test project's settings: the PREVIEW_ names if set, otherwise the normal names (when those have been
  // set to the test project for Preview in Vercel). Whatever they are, they must not be the live database.
  const LIVE_REF = 'vklzcbbewhyakqfcbdvv'
  const service = clean(process.env.PREVIEW_SUPABASE_SERVICE_ROLE_KEY) || clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  const url = cleanUrl(process.env.PREVIEW_SUPABASE_URL) || cleanUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const anon = clean(process.env.PREVIEW_SUPABASE_ANON_KEY) || clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  const missing = [
    !url && 'PREVIEW_SUPABASE_URL',
    !anon && 'PREVIEW_SUPABASE_ANON_KEY',
    !service && 'PREVIEW_SUPABASE_SERVICE_ROLE_KEY',
  ].filter(Boolean)
  if (missing.length) {
    throw new Error(`Preview build stopped: set ${missing.join(', ')} for Preview in Vercel (the test database's settings).`)
  }
  let urlRef
  try {
    urlRef = new URL(url).hostname.split('.')[0]
  } catch {
    throw new Error('Preview build stopped: PREVIEW_SUPABASE_URL is not a web address (it should look like https://xxxx.supabase.co).')
  }
  // A preview must never point at the live database, even by mistake.
  if (urlRef === LIVE_REF) {
    throw new Error('Preview build stopped: the preview settings point at the live database. Use the test database (core-portal-preview).')
  }
  // Older keys (long, starting eyJ) carry their project id, so check they match the address. Newer keys
  // (sb_secret_..., sb_publishable_...) don't, but they only work on their own project anyway.
  for (const [name, key] of [['PREVIEW_SUPABASE_SERVICE_ROLE_KEY', service], ['PREVIEW_SUPABASE_ANON_KEY', anon]]) {
    const ref = projectRef(key)
    if (ref && ref !== urlRef) {
      throw new Error(`Preview build stopped: ${name} belongs to a different Supabase project than PREVIEW_SUPABASE_URL.`)
    }
  }
  previewEnv = {
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anon,
    SUPABASE_SERVICE_ROLE_KEY: service,
    RESEND_API_KEY: '',
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: previewEnv,
  // The new cleaner app replaces the old dashboard (old links and phone notifications still point there).
  async redirects() {
    return [
      { source: '/cleaner/dashboard', destination: '/cleaner/app', permanent: false },
      ...['dashboard', 'services', 'compliance', 'contact'].map(p => ({ source: '/client/' + p, destination: '/client/app', permanent: false })),
    ]
  },
  serverExternalPackages: ['pdf-parse'],
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse'],
    // Job photos are uploaded through a server action. The default 1 MB cap
    // rejected most phone photos; Vercel itself caps requests at 4.5 MB.
    serverActions: { bodySizeLimit: '4mb' },
    // These PDFs are read via a runtime-built fs path (src/actions/cold-leads.ts),
    // which Vercel's file tracer can't follow statically — without this they get
    // silently dropped from the serverless bundle and emails send with no attachment.
    outputFileTracingIncludes: {
      '/**': ['./src/lib/documents/assets/**/*', './src/app/(hub)/hub/hub.css'],
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/**',
      },
    ],
  },
}

export default nextConfig
