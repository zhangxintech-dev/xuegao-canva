import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const schemaPath = path.resolve(__dirname, '..', 'schema.sql')
const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}

const pool = new Pool({ connectionString })

try {
  const info = await pool.query('select current_database() as database, current_user as user, inet_server_addr() as host, inet_server_port() as port')
  console.log('PostgreSQL connected:', info.rows[0])

  const schema = await readFile(schemaPath, 'utf8')
  await pool.query(schema)
  console.log('Schema initialized')

  const tables = await pool.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
    order by table_name
  `)
  console.log('Tables:', tables.rows.map(row => row.table_name).join(', '))
} catch (error) {
  console.error('PostgreSQL check failed:', error.message)
  if (error.code) console.error('code:', error.code)
  if (error.detail) console.error('detail:', error.detail)
  process.exitCode = 1
} finally {
  await pool.end().catch(() => {})
}
