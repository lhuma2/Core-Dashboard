import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Temporary diagnostic — confirms the static PDF assets used by the cold-call
// email attachments are actually reachable in the deployed serverless bundle.
// Delete after use.
export async function GET() {
  const assets = [
    'src/lib/documents/assets/capability-statement.pdf',
    'src/lib/documents/assets/bond-cleaning-price-guide.pdf',
  ]

  const results: Record<string, any> = { cwd: process.cwd() }
  for (const a of assets) {
    try {
      const { readFile } = await import('node:fs/promises')
      const path = await import('node:path')
      const buf = await readFile(path.join(process.cwd(), a))
      results[a] = { ok: true, bytes: buf.length }
    } catch (e: any) {
      results[a] = { ok: false, error: e?.message }
    }
  }

  return NextResponse.json(results)
}
