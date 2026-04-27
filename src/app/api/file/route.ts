import { NextRequest, NextResponse } from 'next/server'

/**
 * Proxies files from Supabase storage through our own domain.
 * Eliminates all cross-origin blocking issues on iOS/PWA.
 *
 * Usage: /api/file?url=<base64-encoded-supabase-url>&dl=1 (dl=1 forces download)
 */
export async function GET(req: NextRequest) {
  const encoded = req.nextUrl.searchParams.get('url')
  const download = req.nextUrl.searchParams.get('dl') === '1'

  if (!encoded) {
    return new NextResponse('Missing url', { status: 400 })
  }

  let fileUrl: string
  try {
    fileUrl = Buffer.from(encoded, 'base64url').toString('utf8')
      .replace(/[\n\r\t ]/g, '')   // actual whitespace
      .replace(/%0[aA]/g, '')       // URL-encoded newlines (%0A or %0a)
  } catch {
    return new NextResponse('Invalid url', { status: 400 })
  }

  // Only allow Supabase storage URLs
  if (!fileUrl.includes('supabase.co')) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  try {
    const upstream = await fetch(fileUrl)
    if (!upstream.ok) {
      return new NextResponse('File not found', { status: upstream.status })
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
    const filename = fileUrl.split('/').pop() ?? 'document'

    return new NextResponse(upstream.body, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': download
          ? `attachment; filename="${filename}"`
          : 'inline',
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch {
    return new NextResponse('Failed to fetch file', { status: 502 })
  }
}
