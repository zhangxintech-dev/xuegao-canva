import { readDb, updateDb } from '../db.js'
import { createId, HttpError, readJsonBody, sendJson } from '../lib/http.js'
import { writeLog } from '../lib/log.js'
import { requireAdmin } from '../middleware/auth.js'
import { hashPassword } from '../lib/token.js'

const publicUser = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  avatarUrl: user.avatarUrl || '',
  quotaTotal: user.quotaTotal ?? 100,
  quotaUsed: user.quotaUsed ?? 0,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
})

const publicProject = (project, owner = null) => ({
  id: project.id,
  name: project.name,
  ownerId: project.ownerId,
  ownerEmail: owner?.email || '',
  ownerName: owner?.name || '',
  teamId: project.teamId || '',
  thumbnail: project.thumbnail || '',
  nodeCount: project.canvasData?.nodes?.length || 0,
  edgeCount: project.canvasData?.edges?.length || 0,
  createdAt: project.createdAt,
  updatedAt: project.updatedAt
})

const getUserIdFromPath = (pathname) => {
  const match = pathname.match(/^\/api\/admin\/users\/([^/]+)/)
  return match?.[1] || ''
}

const publicModelConfig = (model) => ({
  id: model.id,
  type: model.type,
  provider: model.provider,
  modelKey: model.modelKey,
  displayName: model.displayName,
  baseUrl: model.baseUrl || '',
  endpoint: model.endpoint || '',
  queryEndpoint: model.queryEndpoint || '',
  hasApiKey: !!model.apiKey,
  defaultParams: model.defaultParams || {},
  enabled: model.enabled !== false,
  healthStatus: model.healthStatus || 'unchecked',
  healthMessage: model.healthMessage || '',
  healthCheckedAt: model.healthCheckedAt || '',
  createdAt: model.createdAt,
  updatedAt: model.updatedAt
})

const getModelKey = (model) => (
  model?.id ||
  model?.key ||
  model?.model ||
  model?.modelKey ||
  model?.model_key ||
  model?.name ||
  model?.fullName ||
  model?.full_name ||
  ''
)
const getModelLabel = (model, key) => (
  model?.label ||
  model?.displayName ||
  model?.display_name ||
  model?.modelName ||
  model?.model_name ||
  model?.name ||
  key
)

const inferModelType = (key = '') => {
  const value = key.toLowerCase()
  if (/(gpt-image|dall[-_]?e|imagen|image|img|seedream|seededit|flux|sdxl|stable[-_]?diffusion|kolors|recraft|ideogram|midjourney|\bmj\b|dreamina)/.test(value)) return 'image'
  if (/(sora|veo\d*|video|wan\d*|kling|hailuo|runway|luma|pika|vidu|minimax|cogvideo|seedance)/.test(value)) return 'video'
  return 'chat'
}

const normalizeModelType = (value, fallback = '') => {
  const type = String(value || '').toLowerCase()
  if (['image', 'img', 'picture', 'text-to-image', 'txt2img', 'image-generation'].includes(type)) return 'image'
  if (['video', 'movie', 'text-to-video', 'txt2video', 'video-generation'].includes(type)) return 'video'
  if (['chat', 'text', 'llm', 'language', 'completion', 'text-generation'].includes(type)) return 'chat'
  if (/image|img|picture/.test(type)) return 'image'
  if (/video|movie/.test(type)) return 'video'
  if (/chat|text|llm|language|completion/.test(type)) return 'chat'
  return fallback
}

const getRecordModelType = (model, key, fallbackType = '') => (
  normalizeModelType(
    model?.type ||
    model?.modelType ||
    model?.model_type ||
    model?.modelTypeName ||
    model?.category ||
    model?.modelCategory ||
    model?.model_category ||
    model?.group,
    ''
  ) || inferModelType(key) || fallbackType || 'chat'
)

const extractModelRecords = (payload) => {
  const candidates = [
    payload?.data?.records,
    payload?.data?.rows,
    payload?.data?.list,
    payload?.data?.items,
    payload?.data?.models,
    payload?.data?.data,
    payload?.records,
    payload?.rows,
    payload?.data,
    payload?.items,
    payload?.list,
    payload?.models
  ]
  return candidates.find(Array.isArray) || []
}

const getScanEndpoints = ({ provider, type, baseUrl }) => {
  const base = String(baseUrl || '').replace(/\/+$/, '')
  if (!base) throw new HttpError(400, 'baseUrl is required')
  if (provider === 'openai') {
    return [base.endsWith('/v1') ? `${base}/models` : `${base}/v1/models`]
  }
  const root = base.endsWith('/v1') ? base.replace(/\/v1$/, '') : base
  const apiRoot = base.endsWith('/v1') ? base : `${base}/v1`
  const params = new URLSearchParams({ enable: 'true', size: '1000', current: '1', type })
  return [
    `${root}/model/page?${params.toString()}`,
    `${root}/models?${params.toString()}`,
    `${apiRoot}/models`,
    `${base}/models`
  ]
}

const scanProviderModels = async ({ provider, type, baseUrl, apiKey }) => {
  const endpoints = [...new Set(getScanEndpoints({ provider, type, baseUrl }))]
  const errors = []

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
      })
      const text = await response.text()
      const payload = text ? JSON.parse(text) : {}
      if (!response.ok) {
        errors.push({
          endpoint,
          status: response.status,
          message: payload?.message || payload?.error?.message || payload?.msg || response.statusText
        })
        continue
      }

      const models = extractModelRecords(payload)
        .map((model) => {
          const key = getModelKey(model)
          return key ? { key, label: getModelLabel(model, key), type: getRecordModelType(model, key, type) } : null
        })
        .filter(Boolean)

      return {
        endpoint,
        models
      }
    } catch (error) {
      errors.push({
        endpoint,
        message: error.message || 'Scan request failed'
      })
    }
  }

  throw new HttpError(502, 'Scan models failed', { endpoints, errors })
}

const runModelHealthCheck = async (model) => {
  const checkedAt = new Date().toISOString()
  if (model.enabled === false) {
    return { healthStatus: 'unhealthy', healthMessage: '模型已停用', healthCheckedAt: checkedAt }
  }
  if (!model.apiKey) {
    return { healthStatus: 'unhealthy', healthMessage: 'API Key 未配置', healthCheckedAt: checkedAt }
  }
  if (!model.baseUrl) {
    return { healthStatus: 'unhealthy', healthMessage: 'Base URL 未配置', healthCheckedAt: checkedAt }
  }

  try {
    const result = await scanProviderModels({
      provider: model.provider,
      type: model.type,
      baseUrl: model.baseUrl,
      apiKey: model.apiKey
    })
    const matched = result.models.some(item => item.key === model.modelKey)
    if (!matched) {
      return {
        healthStatus: 'unhealthy',
        healthMessage: `扫描接口可用，但未返回该模型：${model.modelKey}`,
        healthCheckedAt: checkedAt
      }
    }
    return {
      healthStatus: 'healthy',
      healthMessage: `检测通过：${result.endpoint}`,
      healthCheckedAt: checkedAt
    }
  } catch (error) {
    const firstError = error.details?.errors?.find(item => item.message)
    return {
      healthStatus: 'unhealthy',
      healthMessage: firstError?.message || error.message || '模型检测失败',
      healthCheckedAt: checkedAt
    }
  }
}

const persistModelHealth = async (modelId, health) => {
  return updateDb(async (db) => {
    const item = db.modelConfigs.find(model => model.id === modelId)
    if (!item) throw new HttpError(404, 'Model not found')
    item.healthStatus = health.healthStatus
    item.healthMessage = health.healthMessage
    item.healthCheckedAt = health.healthCheckedAt
    item.updatedAt = new Date().toISOString()
    return item
  })
}

export const handleAdminRoute = async (req, res, pathname) => {
  if (!pathname.startsWith('/api/admin')) return false

  const admin = await requireAdmin(req)

  if (req.method === 'GET' && pathname === '/api/admin/summary') {
    const db = await readDb()
    const summary = {
      users: db.users.length,
      projects: db.projects.length,
      teams: db.teams.length,
      assets: db.assets.length,
      generationTasks: db.generationTasks.length,
      logs: db.operationLogs.length
    }
    return sendJson(res, 200, { code: 200, data: summary })
  }

  if (req.method === 'GET' && pathname === '/api/admin/users') {
    const db = await readDb()
    const users = db.users
      .map(publicUser)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    return sendJson(res, 200, { code: 200, data: { users } })
  }

  if (req.method === 'POST' && pathname === '/api/admin/users') {
    const body = await readJsonBody(req)
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    const name = String(body.name || email || '').trim()
    const quotaTotal = Number(body.quotaTotal ?? process.env.DEFAULT_USER_QUOTA ?? 100)

    if (!email || !password) throw new HttpError(400, 'email and password are required')
    if (password.length < 6) throw new HttpError(400, 'password must be at least 6 characters')
    if (!Number.isFinite(quotaTotal) || quotaTotal < 0) throw new HttpError(400, 'quotaTotal must be a non-negative number')

    const user = await updateDb(async (db) => {
      if (db.users.some(user => user.email === email)) {
        throw new HttpError(409, 'Email already registered')
      }

      const now = new Date().toISOString()
      const item = {
        id: createId('user'),
        email,
        name,
        passwordHash: hashPassword(password),
        avatarUrl: '',
        quotaTotal: Math.floor(quotaTotal),
        quotaUsed: 0,
        createdAt: now,
        updatedAt: now
      }
      db.users.push(item)
      return publicUser(item)
    })

    await writeLog({
      userId: admin.id,
      action: 'admin.user.create',
      message: `Created user: ${user.email}`,
      metadata: { targetUserId: user.id }
    })
    return sendJson(res, 200, { code: 200, data: user })
  }

  const userId = getUserIdFromPath(pathname)
  if (req.method === 'PATCH' && pathname === `/api/admin/users/${userId}/quota`) {
    const body = await readJsonBody(req)
    const quotaTotal = Number(body.quotaTotal)
    if (!Number.isFinite(quotaTotal) || quotaTotal < 0) {
      throw new HttpError(400, 'quotaTotal must be a non-negative number')
    }

    const target = await updateDb(async (db) => {
      const user = db.users.find(item => item.id === userId)
      if (!user) throw new HttpError(404, 'User not found')
      user.quotaTotal = Math.floor(quotaTotal)
      user.updatedAt = new Date().toISOString()
      return publicUser(user)
    })

    await writeLog({
      userId: admin.id,
      action: 'admin.user.quota.update',
      message: `Updated user quota: ${target.email}`,
      metadata: { targetUserId: userId, quotaTotal: target.quotaTotal }
    })
    return sendJson(res, 200, { code: 200, data: target })
  }

  if (req.method === 'GET' && pathname === '/api/admin/projects') {
    const db = await readDb()
    const projects = db.projects
      .map(project => publicProject(project, db.users.find(user => user.id === project.ownerId)))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    return sendJson(res, 200, { code: 200, data: { projects } })
  }

  if (req.method === 'GET' && pathname === '/api/admin/logs') {
    const db = await readDb()
    const logs = db.operationLogs
      .map(log => ({
        ...log,
        userEmail: db.users.find(user => user.id === log.userId)?.email || ''
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 300)
    return sendJson(res, 200, { code: 200, data: { logs } })
  }

  if (req.method === 'GET' && pathname === '/api/admin/models') {
    const db = await readDb()
    const models = db.modelConfigs
      .map(publicModelConfig)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    return sendJson(res, 200, { code: 200, data: { models } })
  }

  if (req.method === 'POST' && pathname === '/api/admin/models/scan') {
    const body = await readJsonBody(req)
    const type = ['image', 'video', 'chat'].includes(body.type) ? body.type : ''
    if (!type) throw new HttpError(400, 'type is required')
    const result = await scanProviderModels({
      provider: String(body.provider || 'xuegao').trim(),
      type,
      baseUrl: String(body.baseUrl || '').trim(),
      apiKey: String(body.apiKey || '').trim()
    })
    return sendJson(res, 200, { code: 200, data: result })
  }

  if (req.method === 'POST' && pathname === '/api/admin/models') {
    const body = await readJsonBody(req)
    const type = ['image', 'video', 'chat'].includes(body.type) ? body.type : ''
    const modelKey = String(body.modelKey || '').trim()
    if (!type || !modelKey) throw new HttpError(400, 'type and modelKey are required')

    const now = new Date().toISOString()
    const model = await updateDb(async (db) => {
      const provider = String(body.provider || 'cloud').trim()
      const baseUrl = String(body.baseUrl || '').trim().replace(/\/+$/, '')
      const existing = db.modelConfigs.find(item =>
        item.type === type &&
        item.provider === provider &&
        String(item.baseUrl || '').replace(/\/+$/, '') === baseUrl &&
        item.modelKey === modelKey
      )

      if (existing) {
        existing.displayName = String(body.displayName || modelKey).trim()
        existing.endpoint = String(body.endpoint || '').trim()
        existing.queryEndpoint = String(body.queryEndpoint || '').trim()
        existing.defaultParams = body.defaultParams || existing.defaultParams || {}
        existing.enabled = body.enabled !== false
        if (String(body.apiKey || '').trim()) existing.apiKey = String(body.apiKey).trim()
        existing.healthStatus = 'checking'
        existing.healthMessage = '等待检测'
        existing.healthCheckedAt = ''
        existing.updatedAt = now
        return existing
      }

      const item = {
        id: createId('model'),
        type,
        provider,
        modelKey,
        displayName: String(body.displayName || modelKey).trim(),
        baseUrl,
        apiKey: String(body.apiKey || '').trim(),
        endpoint: String(body.endpoint || '').trim(),
        queryEndpoint: String(body.queryEndpoint || '').trim(),
        defaultParams: body.defaultParams || {},
        enabled: body.enabled !== false,
        healthStatus: 'checking',
        healthMessage: '等待检测',
        healthCheckedAt: '',
        createdAt: now,
        updatedAt: now
      }
      db.modelConfigs.unshift(item)
      return item
    })

    const health = await runModelHealthCheck(model)
    const checkedModel = await persistModelHealth(model.id, health)
    await writeLog({ userId: admin.id, action: 'admin.model.create', message: `Created model ${model.modelKey}`, metadata: { type: model.type, healthStatus: health.healthStatus } })
    return sendJson(res, 200, { code: 200, data: publicModelConfig(checkedModel) })
  }

  if (req.method === 'POST' && pathname === '/api/admin/models/health-check') {
    const db = await readDb()
    const targets = db.modelConfigs.filter(model => model.enabled !== false)
    const results = []
    for (const model of targets) {
      const health = await runModelHealthCheck(model)
      const checkedModel = await persistModelHealth(model.id, health)
      results.push(publicModelConfig(checkedModel))
    }
    await writeLog({ userId: admin.id, action: 'admin.model.healthCheckAll', message: `Checked ${results.length} models` })
    return sendJson(res, 200, { code: 200, data: { models: results } })
  }

  const modelHealthMatch = pathname.match(/^\/api\/admin\/models\/([^/]+)\/health$/)
  if (modelHealthMatch && req.method === 'POST') {
    const modelId = modelHealthMatch[1]
    const db = await readDb()
    const model = db.modelConfigs.find(item => item.id === modelId)
    if (!model) throw new HttpError(404, 'Model not found')
    const health = await runModelHealthCheck(model)
    const checkedModel = await persistModelHealth(model.id, health)
    await writeLog({ userId: admin.id, action: 'admin.model.healthCheck', message: `Checked model ${model.modelKey}`, metadata: { healthStatus: health.healthStatus } })
    return sendJson(res, 200, { code: 200, data: publicModelConfig(checkedModel) })
  }

  const modelMatch = pathname.match(/^\/api\/admin\/models\/([^/]+)$/)
  if (modelMatch && req.method === 'PATCH') {
    const modelId = modelMatch[1]
    const body = await readJsonBody(req)
    const model = await updateDb(async (db) => {
      const item = db.modelConfigs.find(model => model.id === modelId)
      if (!item) throw new HttpError(404, 'Model not found')
      if (body.type && ['image', 'video', 'chat'].includes(body.type)) item.type = body.type
      if (body.provider !== undefined) item.provider = String(body.provider).trim()
      if (body.modelKey !== undefined) item.modelKey = String(body.modelKey).trim()
      if (body.displayName !== undefined) item.displayName = String(body.displayName).trim()
      if (body.baseUrl !== undefined) item.baseUrl = String(body.baseUrl).trim().replace(/\/+$/, '')
      if (body.apiKey !== undefined && String(body.apiKey).trim()) item.apiKey = String(body.apiKey).trim()
      if (body.endpoint !== undefined) item.endpoint = String(body.endpoint).trim()
      if (body.queryEndpoint !== undefined) item.queryEndpoint = String(body.queryEndpoint).trim()
      if (body.defaultParams !== undefined) item.defaultParams = body.defaultParams || {}
      if (body.enabled !== undefined) item.enabled = !!body.enabled
      item.healthStatus = item.enabled ? 'checking' : 'unhealthy'
      item.healthMessage = item.enabled ? '等待检测' : '模型已停用'
      item.healthCheckedAt = ''
      item.updatedAt = new Date().toISOString()
      return item
    })
    const health = await runModelHealthCheck(model)
    const checkedModel = await persistModelHealth(model.id, health)
    await writeLog({ userId: admin.id, action: 'admin.model.update', message: `Updated model ${model.modelKey}`, metadata: { healthStatus: health.healthStatus } })
    return sendJson(res, 200, { code: 200, data: publicModelConfig(checkedModel) })
  }

  if (modelMatch && req.method === 'DELETE') {
    const modelId = modelMatch[1]
    await updateDb(async (db) => {
      db.modelConfigs = db.modelConfigs.filter(model => model.id !== modelId)
    })
    await writeLog({ userId: admin.id, action: 'admin.model.delete', message: 'Deleted model config', metadata: { modelId } })
    return sendJson(res, 200, { code: 200, data: { ok: true } })
  }

  return false
}
