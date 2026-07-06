import pg from 'pg'
const client = new pg.Client({
  host: process.env.PGHOST, port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER, password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE || 'postgres', ssl: { rejectUnauthorized: false },
})
await client.connect()
const tables = await client.query(`select table_name from information_schema.tables where table_schema='public' order by table_name`)
console.log('Tables (' + tables.rows.length + '):')
console.log(tables.rows.map(r => r.table_name).join(', '))
const fns = await client.query(`select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by proname`)
console.log('\nFunctions (' + fns.rows.length + '): ' + fns.rows.map(r => r.proname).join(', '))
const clientsCount = await client.query('select count(*) from clients')
const settingsCount = await client.query('select count(*) from settings')
console.log('\nclients rows: ' + clientsCount.rows[0].count + ' (should be 0 — clean start)')
console.log('settings rows: ' + settingsCount.rows[0].count)
await client.end()
