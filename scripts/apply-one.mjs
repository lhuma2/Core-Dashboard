// Apply a SINGLE migration file to the live DB (no schema reset).
// Usage: node scripts/apply-one.mjs supabase/migrations/035_company_documents.sql
import { readFileSync } from 'node:fs'
import pg from 'pg'
const file = process.argv[2]
if (!file) { console.error('pass a .sql path'); process.exit(1) }
const client = new pg.Client({
  host: process.env.PGHOST, port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER, password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE || 'postgres', ssl: { rejectUnauthorized: false },
})
await client.connect()
try {
  await client.query(readFileSync(file, 'utf8'))
  console.log('[OK] applied', file)
} catch (e) { console.error('[FAIL]', e.message); process.exitCode = 1 }
finally { await client.end() }
