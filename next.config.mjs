/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['pdf-parse'],
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse'],
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
