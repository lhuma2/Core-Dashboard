import 'server-only'

/** The capability statement: the one Laith sent for the new hub (hub-rebuild/assets), bundled with the server code. */
export async function capabilityStatement(): Promise<Buffer | null> {
  try {
    const { readFile } = await import('node:fs/promises')
    const path = await import('node:path')
    return await readFile(path.join(process.cwd(), 'src/lib/documents/assets/prospecting/capability-statement.pdf'))
  } catch { return null }
}
