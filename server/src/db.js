import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from './config.js'
import { createId } from './lib/http.js'
import { hashPassword } from './lib/token.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const schemaPath = path.resolve(__dirname, '..', 'schema.sql')
const dbPath = path.join(config.dataDir, 'db.json')
const requestedDbMode = process.env.DB_MODE === 'postgres' ? 'postgres' : 'json'
const usePostgres = requestedDbMode === 'postgres'

const initialData = {
  users: [],
  teams: [],
  teamMembers: [],
  projects: [],
  projectMembers: [],
  workflowVersions: [],
  savedWorkflows: [],
  assets: [],
  generationTasks: [],
  quotaRecords: [],
  modelConfigs: [],
  operationLogs: [],
  collaborationEvents: []
}

let cache = null
let pgPool = null
let pgInitialized = false

const defaultCanvasData = () => ({
  nodes: [],
  edges: [],
  viewport: { x: 100, y: 50, zoom: 0.8 }
})

const toIso = (value) => value ? new Date(value).toISOString() : new Date().toISOString()
const jsonValue = (value, fallback) => value === undefined || value === null ? fallback : value

const getPgPool = async () => {
  if (pgPool) return pgPool

  try {
    const { Pool } = await import('pg')
    pgPool = new Pool({ connectionString: process.env.DATABASE_URL })
    return pgPool
  } catch (error) {
    throw new Error(`PostgreSQL mode requires the "pg" package. Run: npm install --prefix server. ${error.message}`)
  }
}

const ensureJsonStorage = async () => {
  await fs.mkdir(config.dataDir, { recursive: true })
  await fs.mkdir(config.uploadDir, { recursive: true })

  try {
    await fs.access(dbPath)
  } catch {
    await fs.writeFile(dbPath, JSON.stringify(initialData, null, 2))
  }
}

const ensurePostgresStorage = async () => {
  await fs.mkdir(config.uploadDir, { recursive: true })
  if (pgInitialized) return
  if (!process.env.DATABASE_URL) {
    throw new Error('DB_MODE=postgres requires DATABASE_URL. Example: DB_MODE=postgres DATABASE_URL="postgres://user:password@127.0.0.1:5432/xuegao_canvas" npm run dev:server:pg')
  }

  console.log(`[db] connecting PostgreSQL: ${maskConnectionString(process.env.DATABASE_URL)}`)
  const pool = await getPgPool()
  const schema = await fs.readFile(schemaPath, 'utf8')
  console.log('[db] initializing schema')
  await pool.query(schema)
  pgInitialized = true
  console.log('[db] PostgreSQL schema ready')
}

export const ensureStorage = async () => {
  if (usePostgres) {
    await ensurePostgresStorage()
    await seedDefaultAdmin()
    return
  }
  await ensureJsonStorage()
  await seedDefaultAdmin()
}

const getDefaultAdmin = () => ({
  email: String(process.env.ADMIN_EMAIL || 'zian@bencom.cn').trim().toLowerCase(),
  password: String(process.env.ADMIN_PASSWORD || '123456'),
  name: String(process.env.ADMIN_NAME || '雪糕管理员').trim(),
  quotaTotal: Number(process.env.DEFAULT_USER_QUOTA || 100)
})

const maskConnectionString = (value = '') => value.replace(/:\/\/([^:@/]+):([^@/]+)@/, '://$1:***@')

const seedDefaultAdmin = async () => {
  const admin = getDefaultAdmin()
  if (!admin.email || !admin.password) return

  const data = await readDb()
  const existing = data.users.find(user => user.email === admin.email)

  if (existing) {
    let changed = false
    if (!existing.passwordHash) {
      existing.passwordHash = hashPassword(admin.password)
      changed = true
    }
    if (existing.quotaTotal === undefined || existing.quotaTotal === null) {
      existing.quotaTotal = admin.quotaTotal
      changed = true
    }
    if (existing.quotaUsed === undefined || existing.quotaUsed === null) {
      existing.quotaUsed = 0
      changed = true
    }
    if (changed) {
      existing.updatedAt = new Date().toISOString()
      await writeDb(data)
    }
    return
  }

  const now = new Date().toISOString()
  data.users.unshift({
    id: createId('user'),
    email: admin.email,
    name: admin.name || admin.email,
    passwordHash: hashPassword(admin.password),
    avatarUrl: '',
    quotaTotal: admin.quotaTotal,
    quotaUsed: 0,
    createdAt: now,
    updatedAt: now
  })
  await writeDb(data)
  console.log(`[db] seeded default admin: ${admin.email}`)
}

const readJsonDb = async () => {
  if (cache) return cache
  await ensureJsonStorage()
  const raw = await fs.readFile(dbPath, 'utf8')
  cache = {
    ...initialData,
    ...JSON.parse(raw)
  }
  return cache
}

const mapUser = (row) => ({
  id: row.id,
  email: row.email,
  passwordHash: row.password_hash,
  name: row.name,
  avatarUrl: row.avatar_url || '',
  quotaTotal: row.quota_total,
  quotaUsed: row.quota_used,
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at)
})

const mapProject = (row) => ({
  id: row.id,
  ownerId: row.owner_id,
  teamId: row.team_id || '',
  name: row.name,
  thumbnail: row.thumbnail || '',
  visibility: row.visibility || 'personal',
  canvasData: jsonValue(row.canvas_data, defaultCanvasData()),
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at)
})

const readPgDb = async () => {
  await ensurePostgresStorage()
  const pool = await getPgPool()

  const [
    users,
    teams,
    teamMembers,
    projects,
    projectMembers,
    workflowVersions,
    savedWorkflows,
    assets,
    generationTasks,
    quotaRecords,
    modelConfigs,
    operationLogs,
    collaborationEvents
  ] = await Promise.all([
    pool.query('SELECT * FROM users ORDER BY created_at ASC'),
    pool.query('SELECT * FROM teams ORDER BY created_at ASC'),
    pool.query('SELECT * FROM team_members ORDER BY created_at ASC'),
    pool.query('SELECT * FROM projects ORDER BY created_at ASC'),
    pool.query('SELECT * FROM project_members ORDER BY created_at ASC'),
    pool.query('SELECT * FROM workflow_versions ORDER BY created_at ASC'),
    pool.query('SELECT * FROM saved_workflows ORDER BY created_at ASC'),
    pool.query('SELECT * FROM assets ORDER BY created_at ASC'),
    pool.query('SELECT * FROM generation_tasks ORDER BY created_at ASC'),
    pool.query('SELECT * FROM quota_records ORDER BY created_at ASC'),
    pool.query('SELECT * FROM model_configs ORDER BY created_at ASC'),
    pool.query('SELECT * FROM operation_logs ORDER BY created_at ASC'),
    pool.query('SELECT * FROM collaboration_events ORDER BY created_at ASC')
  ])

  return {
    users: users.rows.map(mapUser),
    teams: teams.rows.map(row => ({
      id: row.id,
      ownerId: row.owner_id,
      name: row.name,
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at)
    })),
    teamMembers: teamMembers.rows.map(row => ({
      teamId: row.team_id,
      userId: row.user_id,
      role: row.role,
      createdAt: toIso(row.created_at)
    })),
    projects: projects.rows.map(mapProject),
    projectMembers: projectMembers.rows.map(row => ({
      projectId: row.project_id,
      userId: row.user_id,
      role: row.role,
      createdAt: toIso(row.created_at)
    })),
    workflowVersions: workflowVersions.rows.map(row => ({
      id: row.id,
      projectId: row.project_id,
      userId: row.user_id,
      version: row.version,
      name: row.name,
      canvasData: jsonValue(row.canvas_data, {}),
      createdAt: toIso(row.created_at)
    })),
    savedWorkflows: savedWorkflows.rows.map(row => ({
      id: row.id,
      ownerId: row.owner_id,
      name: row.name,
      thumbnail: row.thumbnail || '',
      visibility: row.visibility || 'personal',
      nodes: jsonValue(row.workflow_data, {}).nodes || [],
      edges: jsonValue(row.workflow_data, {}).edges || [],
      viewport: jsonValue(row.workflow_data, {}).viewport || {},
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at)
    })),
    assets: assets.rows.map(row => ({
      id: row.id,
      ownerId: row.owner_id,
      projectId: row.project_id || '',
      type: row.type,
      url: row.url,
      storageKey: row.storage_key,
      width: row.width,
      height: row.height,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      createdAt: toIso(row.created_at)
    })),
    generationTasks: generationTasks.rows.map(row => ({
      id: row.id,
      projectId: row.project_id || '',
      userId: row.user_id,
      type: row.type,
      model: row.model || '',
      prompt: row.prompt || '',
      inputAssetIds: jsonValue(row.input_asset_ids, []),
      outputAssetIds: jsonValue(row.output_asset_ids, []),
      status: row.status,
      errorMessage: row.error_message || '',
      requestJson: jsonValue(row.request_json, {}),
      quotaCost: row.quota_cost,
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at)
    })),
    quotaRecords: quotaRecords.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      taskId: row.task_id || '',
      amount: row.amount,
      reason: row.reason,
      createdAt: toIso(row.created_at)
    })),
    modelConfigs: modelConfigs.rows.map(row => ({
      id: row.id,
      type: row.type,
      provider: row.provider,
      modelKey: row.model_key,
      displayName: row.display_name,
      baseUrl: row.base_url || '',
      apiKey: row.api_key || '',
      endpoint: row.endpoint || '',
      queryEndpoint: row.query_endpoint || '',
      defaultParams: jsonValue(row.default_params, {}),
      enabled: row.enabled,
      healthStatus: row.health_status || 'unchecked',
      healthMessage: row.health_message || '',
      healthCheckedAt: toIso(row.health_checked_at),
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at)
    })),
    operationLogs: operationLogs.rows.map(row => ({
      id: row.id,
      userId: row.user_id || '',
      projectId: row.project_id || '',
      action: row.action,
      level: row.level,
      message: row.message,
      metadata: jsonValue(row.metadata, {}),
      createdAt: toIso(row.created_at)
    })),
    collaborationEvents: collaborationEvents.rows.map(row => ({
      id: row.id,
      projectId: row.project_id,
      userId: row.user_id,
      type: row.type,
      payload: jsonValue(row.payload, {}),
      createdAt: toIso(row.created_at)
    }))
  }
}

export const readDb = async () => {
  if (usePostgres) return readPgDb()
  return readJsonDb()
}

const writeJsonDb = async (data) => {
  cache = data
  await ensureJsonStorage()
  await fs.writeFile(dbPath, JSON.stringify(data, null, 2))
  return cache
}

const insertRows = async (client, sql, rows, getValues) => {
  for (const row of rows) {
    await client.query(sql, getValues(row))
  }
}

const writePgDb = async (data) => {
  await ensurePostgresStorage()
  const pool = await getPgPool()
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await client.query(`
      DELETE FROM collaboration_events;
      DELETE FROM operation_logs;
      DELETE FROM quota_records;
      DELETE FROM generation_tasks;
      DELETE FROM assets;
      DELETE FROM saved_workflows;
      DELETE FROM workflow_versions;
      DELETE FROM project_members;
      DELETE FROM projects;
      DELETE FROM team_members;
      DELETE FROM teams;
      DELETE FROM model_configs;
      DELETE FROM users;
    `)

    await insertRows(client, `
      INSERT INTO users (id, email, password_hash, name, avatar_url, quota_total, quota_used, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    `, data.users, row => [
      row.id,
      row.email,
      row.passwordHash,
      row.name,
      row.avatarUrl || '',
      row.quotaTotal ?? 100,
      row.quotaUsed ?? 0,
      row.createdAt,
      row.updatedAt
    ])

    await insertRows(client, `
      INSERT INTO teams (id, owner_id, name, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5)
    `, data.teams, row => [row.id, row.ownerId, row.name, row.createdAt, row.updatedAt])

    await insertRows(client, `
      INSERT INTO team_members (team_id, user_id, role, created_at)
      VALUES ($1,$2,$3,$4)
    `, data.teamMembers, row => [row.teamId, row.userId, row.role, row.createdAt])

    await insertRows(client, `
      INSERT INTO projects (id, owner_id, team_id, name, thumbnail, visibility, canvas_data, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)
    `, data.projects, row => [
      row.id,
      row.ownerId,
      row.teamId || null,
      row.name,
      row.thumbnail || '',
      row.visibility || 'personal',
      JSON.stringify(row.canvasData || {}),
      row.createdAt,
      row.updatedAt
    ])

    await insertRows(client, `
      INSERT INTO project_members (project_id, user_id, role, created_at)
      VALUES ($1,$2,$3,$4)
    `, data.projectMembers, row => [row.projectId, row.userId, row.role, row.createdAt])

    await insertRows(client, `
      INSERT INTO workflow_versions (id, project_id, user_id, version, name, canvas_data, created_at)
      VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)
    `, data.workflowVersions, row => [
      row.id,
      row.projectId,
      row.userId,
      row.version,
      row.name,
      JSON.stringify(row.canvasData || {}),
      row.createdAt
    ])

    await insertRows(client, `
      INSERT INTO saved_workflows (id, owner_id, name, thumbnail, visibility, workflow_data, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)
    `, data.savedWorkflows, row => [
      row.id,
      row.ownerId,
      row.name,
      row.thumbnail || '',
      row.visibility || 'personal',
      JSON.stringify({
        nodes: row.nodes || [],
        edges: row.edges || [],
        viewport: row.viewport || {}
      }),
      row.createdAt,
      row.updatedAt
    ])

    await insertRows(client, `
      INSERT INTO assets (id, owner_id, project_id, type, url, storage_key, width, height, mime_type, size_bytes, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    `, data.assets, row => [
      row.id,
      row.ownerId,
      row.projectId || null,
      row.type,
      row.url,
      row.storageKey,
      row.width,
      row.height,
      row.mimeType,
      row.sizeBytes,
      row.createdAt
    ])

    await insertRows(client, `
      INSERT INTO generation_tasks (id, project_id, user_id, type, model, prompt, input_asset_ids, output_asset_ids, status, error_message, request_json, quota_cost, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11::jsonb,$12,$13,$14)
    `, data.generationTasks, row => [
      row.id,
      row.projectId || null,
      row.userId,
      row.type,
      row.model || '',
      row.prompt || '',
      JSON.stringify(row.inputAssetIds || []),
      JSON.stringify(row.outputAssetIds || []),
      row.status,
      row.errorMessage || '',
      JSON.stringify(row.requestJson || {}),
      row.quotaCost || 1,
      row.createdAt,
      row.updatedAt
    ])

    await insertRows(client, `
      INSERT INTO quota_records (id, user_id, task_id, amount, reason, created_at)
      VALUES ($1,$2,$3,$4,$5,$6)
    `, data.quotaRecords, row => [row.id, row.userId, row.taskId || null, row.amount, row.reason, row.createdAt])

    await insertRows(client, `
      INSERT INTO model_configs (id, type, provider, model_key, display_name, base_url, api_key, endpoint, query_endpoint, default_params, enabled, health_status, health_message, health_checked_at, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,$15,$16)
    `, data.modelConfigs, row => [
      row.id,
      row.type,
      row.provider,
      row.modelKey,
      row.displayName,
      row.baseUrl || '',
      row.apiKey || '',
      row.endpoint || '',
      row.queryEndpoint || '',
      JSON.stringify(row.defaultParams || {}),
      row.enabled !== false,
      row.healthStatus || 'unchecked',
      row.healthMessage || '',
      row.healthCheckedAt || null,
      row.createdAt,
      row.updatedAt
    ])

    await insertRows(client, `
      INSERT INTO operation_logs (id, user_id, project_id, action, level, message, metadata, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)
    `, data.operationLogs, row => [
      row.id,
      row.userId || null,
      row.projectId || null,
      row.action,
      row.level || 'info',
      row.message || '',
      JSON.stringify(row.metadata || {}),
      row.createdAt
    ])

    await insertRows(client, `
      INSERT INTO collaboration_events (id, project_id, user_id, type, payload, created_at)
      VALUES ($1,$2,$3,$4,$5::jsonb,$6)
    `, data.collaborationEvents || [], row => [
      row.id,
      row.projectId,
      row.userId,
      row.type,
      JSON.stringify(row.payload || {}),
      row.createdAt
    ])

    await client.query('COMMIT')
    return data
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export const writeDb = async (data) => {
  if (usePostgres) return writePgDb(data)
  return writeJsonDb(data)
}

export const updateDb = async (updater) => {
  const data = {
    ...initialData,
    ...(await readDb())
  }
  const result = await updater(data)
  await writeDb(data)
  return result
}

export const getDbMode = () => requestedDbMode
