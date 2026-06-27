import { NextResponse } from 'next/server'

// TEMPORARY diagnostic: inspect what chromium-min extracts and where the libs land.
export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET() {
  const out: any = {}
  try {
    const chromium = (await import('@sparticuz/chromium-min')).default
    const PACK = process.env.CHROMIUM_PACK_URL
      || 'https://github.com/Sparticuz/chromium/releases/download/v123.0.1/chromium-v123.0.1-pack.tar'
    out.pack = PACK
    const exe = await chromium.executablePath(PACK)
    out.executablePath = exe
    out.ldLibraryPath = process.env.LD_LIBRARY_PATH ?? null
    out.args = chromium.args?.slice?.(0, 4)

    const fs = await import('fs')
    const walk = (dir: string, depth = 0): string[] => {
      if (depth > 3) return []
      let files: string[] = []
      try {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          const p = `${dir}/${e.name}`
          if (e.isDirectory()) files = files.concat(walk(p, depth + 1))
          else files.push(p)
        }
      } catch { /* ignore */ }
      return files
    }
    const all = walk('/tmp')
    out.hasLibnss3InTmp = all.some(f => f.includes('libnss3'))

    // Does the system base image provide libnss3 anywhere?
    const sysDirs = ['/lib64', '/usr/lib64', '/lib', '/usr/lib', '/var/lang/lib', '/var/task']
    out.systemLibnss3 = []
    out.sysDirsExist = {}
    for (const d of sysDirs) {
      try {
        const files = fs.readdirSync(d)
        out.sysDirsExist[d] = true
        for (const f of files) if (f.includes('libnss3') || f.includes('libnssutil3')) out.systemLibnss3.push(`${d}/${f}`)
      } catch { out.sysDirsExist[d] = false }
    }
    return NextResponse.json(out)
  } catch (e: any) {
    out.error = e?.message ?? String(e)
    return NextResponse.json(out, { status: 500 })
  }
}
