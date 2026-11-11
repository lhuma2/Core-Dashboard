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

let previewEnv = {}
if (isPreview) {
  const service = process.env.PREVIEW_SUPABASE_SERVICE_ROLE_KEY
  const url = process.env.PREVIEW_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.PREVIEW_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!service || !url || !anon) {
    throw new Error(
      'Preview build stopped: set PREVIEW_SUPABASE_SERVICE_ROLE_KEY (and the test database URL and anon key) for Preview in Vercel.'
    )
  }
  const urlRef = new URL(url).hostname.split('.')[0]
  if (projectRef(service) !== urlRef || projectRef(anon) !== urlRef) {
    throw new Error(
      'Preview build stopped: the preview database address and keys do not all belong to the same Supabase project.'
    )
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
      '/**': ['./src/lib/documents/assets/**/*'],
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
