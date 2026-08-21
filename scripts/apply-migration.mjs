// Applies a single migration file (by number prefix, e.g. "047") against the
// live database. Non-destructive — just runs that one file's SQL as-is.
// Usage: PGHOST=... PGUSER=... PGPASSWORD=... node scripts/apply-migration.mjs 047
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const prefix = process.argv[2]
if (!prefix) {
  console.error('Usage: node scripts/apply-migration.mjs <migration-number-prefix>')
  process.exit(1)
}

const migrationsDir = join(__dirname, '..', 'supabase', 'migrations')
const file = readdirSync(migrationsDir).find((f) => f.startsWith(prefix))
if (!file) {
  console.error(`No migration found starting with "${prefix}" in ${migrationsDir}`)
  process.exit(1)
}

const sql = readFileSync(join(migrationsDir, file), 'utf8')

const client = new pg.Client({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE || 'postgres',
  ssl: { rejectUnauthorized: false },
})

try {
  console.log(`Applying ${file}...`)
  await client.connect()
  await client.query(sql)
  console.log('[OK] Migration applied successfully.')
} catch (err) {
  console.error('[FAIL]', err.message)
  if (err.position) console.error('   at SQL position:', err.position)
  process.exitCode = 1
} finally {
  await client.end()
}
