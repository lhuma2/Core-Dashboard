// One-off migration runner. Reads the combined SQL and executes it against
// the Supabase Postgres database. Credentials come from env vars so special
// characters in the password don't need URL-encoding or shell-escaping.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))

const client = new pg.Client({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE || 'postgres',
  ssl: { rejectUnauthorized: false },
})

const sql = readFileSync(join(__dirname, '..', 'supabase', 'all_migrations_combined.sql'), 'utf8')

try {
  console.log('Connecting to database...')
  await client.connect()
  console.log('Connected. Running migrations (this may take 20-40s)...')
  await client.query(sql)
  console.log('\n[OK] All migrations applied successfully.')
} catch (err) {
  console.error('\n[FAIL] Migration error:')
  console.error(err.message)
  if (err.position) console.error('   at SQL position:', err.position)
  process.exitCode = 1
} finally {
  await client.end()
}
