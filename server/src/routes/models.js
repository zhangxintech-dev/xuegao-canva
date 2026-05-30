import { readDb } from '../db.js'
import { sendJson } from '../lib/http.js'
import { requireAuth } from '../middleware/auth.js'

const publicModel = (model) => ({
  id: model.id,
  type: model.type,
  provider: model.provider,
  key: model.modelKey,
  modelKey: model.modelKey,
  label: model.displayName || model.modelKey,
  displayName: model.displayName || model.modelKey,
  defaultParams: model.defaultParams || {},
  endpoint: model.endpoint || '',
  queryEndpoint: model.queryEndpoint || '',
  enabled: model.enabled !== false,
  healthStatus: model.healthStatus || 'unchecked',
  isCloud: true
})

export const handleModelsRoute = async (req, res, pathname) => {
  if (req.method !== 'GET') return false
  if (!pathname.startsWith('/api/models/')) return false

  await requireAuth(req)
  const type = pathname.replace('/api/models/', '')
  if (!['image', 'video', 'chat'].includes(type)) return false

  const db = await readDb()
  const models = db.modelConfigs
    .filter(model => model.type === type && model.enabled !== false && model.healthStatus === 'healthy')
    .map(publicModel)
  return sendJson(res, 200, { code: 200, data: { models } })
}
