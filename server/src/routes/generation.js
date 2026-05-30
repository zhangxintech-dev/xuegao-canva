import { readDb, updateDb } from '../db.js'
import { createId, HttpError, readJsonBody, sendJson } from '../lib/http.js'
import { writeLog } from '../lib/log.js'
import { requireAuth } from '../middleware/auth.js'
import { consumeQuota } from './quota.js'

const publicTask = (task) => ({
  id: task.id,
  taskId: task.id,
  projectId: task.projectId,
  type: task.type,
  model: task.model,
  prompt: task.prompt,
  status: task.status,
  inputAssetIds: task.inputAssetIds,
  outputAssetIds: task.outputAssetIds,
  errorMessage: task.errorMessage,
  createdAt: task.createdAt,
  updatedAt: task.updatedAt
})

const buildUrl = (baseUrl, endpoint) => {
  const base = String(baseUrl || '').replace(/\/+$/, '')
  const path = endpoint || '/v1/images/generations'
  if (!base) throw new HttpError(400, 'Model baseUrl is not configured')
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`
  try {
    return new URL(url).toString()
  } catch {
    throw new HttpError(400, `Model Base URL is invalid: ${base}`, { url })
  }
}

const providerNetworkError = (type, url, error) => {
  const cause = error?.cause?.message || error?.message || 'unknown network error'
  return new HttpError(502, `${type} provider network error: ${cause}`, {
    url,
    cause,
    code: error?.cause?.code || error?.code || ''
  })
}

const callImageProvider = async (modelConfig, body) => {
  if (!modelConfig?.apiKey) throw new HttpError(400, 'Model apiKey is not configured')

  const payload = {
    ...(modelConfig.defaultParams || {}),
    ...body,
    model: modelConfig.modelKey
  }
  delete payload.projectId
  delete payload.quotaCost

  const url = buildUrl(modelConfig.baseUrl, modelConfig.endpoint)
  let response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${modelConfig.apiKey}`
      },
      body: JSON.stringify(payload)
    })
  } catch (error) {
    throw providerNetworkError('Image', url, error)
  }
  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { raw: text }
  }
  if (!response.ok) {
    throw new HttpError(response.status, data?.message || data?.error?.message || 'Image provider request failed', data)
  }
  return data
}

const callJsonProvider = async (modelConfig, body, defaultEndpoint) => {
  if (!modelConfig?.apiKey) throw new HttpError(400, 'Model apiKey is not configured')
  const payload = {
    ...(modelConfig.defaultParams || {}),
    ...body,
    model: modelConfig.modelKey
  }
  delete payload.projectId
  delete payload.quotaCost

  const url = buildUrl(modelConfig.baseUrl, modelConfig.endpoint || defaultEndpoint)
  let response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${modelConfig.apiKey}`
      },
      body: JSON.stringify(payload)
    })
  } catch (error) {
    throw providerNetworkError('Provider', url, error)
  }
  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { raw: text }
  }
  if (!response.ok) {
    throw new HttpError(response.status, data?.message || data?.error?.message || 'Provider request failed', data)
  }
  return data
}

const getProviderTaskId = (payload) => {
  return payload?.id ||
    payload?.task_id ||
    payload?.taskId ||
    payload?.data?.id ||
    payload?.data?.task_id ||
    payload?.data?.taskId ||
    payload?.result?.id ||
    payload?.result?.task_id ||
    payload?.result?.taskId ||
    ''
}

const callVideoQueryProvider = async (modelConfig, providerTaskId) => {
  if (!modelConfig?.apiKey) throw new HttpError(400, 'Model apiKey is not configured')
  if (!providerTaskId) throw new HttpError(400, 'Provider taskId is missing')

  const endpoint = modelConfig.queryEndpoint || '/v1/videos/{taskId}'
  const url = buildUrl(modelConfig.baseUrl, endpoint.replaceAll('{taskId}', encodeURIComponent(providerTaskId)))
  let response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${modelConfig.apiKey}`
      }
    })
  } catch (error) {
    throw providerNetworkError('Video query', url, error)
  }
  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { raw: text }
  }
  if (!response.ok) {
    throw new HttpError(response.status, data?.message || data?.error?.message || 'Video query provider request failed', data)
  }
  return data
}

const findEnabledModel = (db, type, modelKey = '') => {
  return db.modelConfigs.find(model =>
    model.type === type &&
    model.enabled !== false &&
    model.healthStatus === 'healthy' &&
    (!modelKey || model.modelKey === modelKey)
  )
}

const extractPrompt = (body) => {
  if (body.prompt) return String(body.prompt)
  if (Array.isArray(body.content)) {
    return body.content
      .map(item => typeof item === 'string' ? item : item?.text || '')
      .filter(Boolean)
      .join('\n')
  }
  return ''
}

const streamChatProvider = async (res, modelConfig, body) => {
  if (!modelConfig?.apiKey) throw new HttpError(400, 'Model apiKey is not configured')

  const payload = {
    ...(modelConfig.defaultParams || {}),
    ...body,
    model: modelConfig.modelKey,
    stream: true
  }

  const url = buildUrl(modelConfig.baseUrl, modelConfig.endpoint || '/v1/chat/completions')
  let response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${modelConfig.apiKey}`
      },
      body: JSON.stringify(payload)
    })
  } catch (error) {
    throw providerNetworkError('Chat', url, error)
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new HttpError(response.status, error?.message || error?.error?.message || 'Chat provider request failed', error)
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  })

  for await (const chunk of response.body) {
    res.write(chunk)
  }
  res.end()
}

export const handleGenerationRoute = async (req, res, pathname) => {
  if (req.method === 'POST' && pathname === '/api/generation/image') {
    const user = await requireAuth(req)
    const body = await readJsonBody(req)
    const now = new Date().toISOString()
    const quotaCost = Number(body.quotaCost || 1)

    const { task, modelConfig } = await updateDb(async (db) => {
      const config = findEnabledModel(db, 'image', body.model)
      if (!config) throw new HttpError(400, 'No enabled cloud image model configured')

      const item = {
        id: createId('task'),
        projectId: body.projectId || '',
        userId: user.id,
        type: body.type || 'image',
        model: config.modelKey,
        prompt: body.prompt || '',
        inputAssetIds: [body.imageAssetId, body.maskAssetId, ...(body.inputAssetIds || [])].filter(Boolean),
        outputAssetIds: [],
        status: 'queued',
        errorMessage: '',
        requestJson: body,
        quotaCost,
        createdAt: now,
        updatedAt: now
      }
      db.generationTasks.push(item)
      return { task: item, modelConfig: config }
    })

    await consumeQuota({ userId: user.id, taskId: task.id, amount: quotaCost, reason: `generation.${task.type}` })
    await writeLog({ userId: user.id, projectId: task.projectId, action: 'generation.create', message: 'Created generation task', metadata: { taskId: task.id, quotaCost } })

    try {
      const providerResult = await callImageProvider(modelConfig, body)
      await updateDb(async (db) => {
        const item = db.generationTasks.find(item => item.id === task.id)
        if (!item) return
        item.status = 'succeeded'
        item.updatedAt = new Date().toISOString()
      })
      return sendJson(res, 200, { code: 200, data: providerResult, task: publicTask({ ...task, status: 'succeeded' }) })
    } catch (error) {
      await updateDb(async (db) => {
        const item = db.generationTasks.find(item => item.id === task.id)
        if (!item) return
        item.status = 'failed'
        item.errorMessage = error.message
        item.updatedAt = new Date().toISOString()
      })
      throw error
    }
  }

  if (req.method === 'POST' && pathname === '/api/generation/chat') {
    const user = await requireAuth(req)
    const body = await readJsonBody(req)
    const quotaCost = Number(body.quotaCost || 1)

    const { task, modelConfig } = await updateDb(async (db) => {
      const config = findEnabledModel(db, 'chat', body.model)
      if (!config) throw new HttpError(400, 'No enabled cloud chat model configured')
      const now = new Date().toISOString()
      const item = {
        id: createId('task'),
        projectId: body.projectId || '',
        userId: user.id,
        type: 'chat',
        model: config.modelKey,
        prompt: body.messages?.at?.(-1)?.content || '',
        inputAssetIds: [],
        outputAssetIds: [],
        status: 'running',
        errorMessage: '',
        requestJson: body,
        quotaCost,
        createdAt: now,
        updatedAt: now
      }
      db.generationTasks.push(item)
      return { task: item, modelConfig: config }
    })

    await consumeQuota({ userId: user.id, taskId: task.id, amount: quotaCost, reason: 'generation.chat' })
    await writeLog({ userId: user.id, projectId: task.projectId, action: 'generation.chat', message: 'Created chat generation task', metadata: { taskId: task.id, quotaCost } })

    try {
      await streamChatProvider(res, modelConfig, body)
      await updateDb(async (db) => {
        const item = db.generationTasks.find(item => item.id === task.id)
        if (!item) return
        item.status = 'succeeded'
        item.updatedAt = new Date().toISOString()
      })
      return true
    } catch (error) {
      await updateDb(async (db) => {
        const item = db.generationTasks.find(item => item.id === task.id)
        if (!item) return
        item.status = 'failed'
        item.errorMessage = error.message
        item.updatedAt = new Date().toISOString()
      })
      throw error
    }
  }

  if (req.method === 'POST' && pathname === '/api/generation/video') {
    const user = await requireAuth(req)
    const body = await readJsonBody(req)
    const quotaCost = Number(body.quotaCost || 1)
    const now = new Date().toISOString()
    const prompt = extractPrompt(body)
    if (!prompt) throw new HttpError(400, 'prompt is required')
    const providerBody = {
      ...body,
      prompt
    }

    const { task, modelConfig } = await updateDb(async (db) => {
      const config = findEnabledModel(db, 'video', body.model)
      if (!config) throw new HttpError(400, 'No enabled cloud video model configured')
      const item = {
        id: createId('task'),
        projectId: body.projectId || '',
        userId: user.id,
        type: 'video',
        model: config.modelKey,
        prompt,
        inputAssetIds: [],
        outputAssetIds: [],
        status: 'running',
        errorMessage: '',
        requestJson: body,
        quotaCost,
        createdAt: now,
        updatedAt: now
      }
      db.generationTasks.push(item)
      return { task: item, modelConfig: config }
    })

    await consumeQuota({ userId: user.id, taskId: task.id, amount: quotaCost, reason: 'generation.video' })
    await writeLog({ userId: user.id, projectId: task.projectId, action: 'generation.video', message: 'Created video generation task', metadata: { taskId: task.id, quotaCost } })

    try {
      const providerResult = await callJsonProvider(modelConfig, providerBody, '/v1/video/generations')
      const providerTaskId = getProviderTaskId(providerResult)
      await updateDb(async (db) => {
        const item = db.generationTasks.find(item => item.id === task.id)
        if (!item) return
        item.status = providerTaskId ? 'running' : 'succeeded'
        item.requestJson = {
          ...item.requestJson,
          providerTaskId,
          providerResult
        }
        item.updatedAt = new Date().toISOString()
      })
      return sendJson(res, 200, {
        code: 200,
        data: providerResult,
        task: publicTask({ ...task, status: providerTaskId ? 'running' : 'succeeded' }),
        taskId: task.id
      })
    } catch (error) {
      await updateDb(async (db) => {
        const item = db.generationTasks.find(item => item.id === task.id)
        if (!item) return
        item.status = 'failed'
        item.errorMessage = error.message
        item.updatedAt = new Date().toISOString()
      })
      throw error
    }
  }

  const match = pathname.match(/^\/api\/generation\/tasks\/([^/]+)$/)
  if (req.method === 'GET' && match) {
    await requireAuth(req)
    const taskId = match[1]
    const db = await readDb()
    const task = db.generationTasks.find(item => item.id === taskId)
    if (!task) {
      return sendJson(res, 404, { code: 404, message: 'Task not found' })
    }
    return sendJson(res, 200, { code: 200, data: publicTask(task) })
  }

  const videoMatch = pathname.match(/^\/api\/generation\/video\/tasks\/([^/]+)$/)
  if (req.method === 'GET' && videoMatch) {
    await requireAuth(req)
    const taskId = videoMatch[1]
    const db = await readDb()
    const task = db.generationTasks.find(item => item.id === taskId)
    if (!task) {
      return sendJson(res, 404, { code: 404, message: 'Task not found' })
    }
    const modelConfig = findEnabledModel(db, 'video', task.model)
    if (!modelConfig) throw new HttpError(400, 'No enabled cloud video model configured')

    const providerTaskId = task.requestJson?.providerTaskId || getProviderTaskId(task.requestJson?.providerResult)
    const providerResult = await callVideoQueryProvider(modelConfig, providerTaskId)
    const providerStatus = providerResult.status || providerResult.data?.status || providerResult.task_status || providerResult.data?.task_status || ''
    const videoUrl = providerResult.data?.url ||
      providerResult.data?.[0]?.url ||
      providerResult.url ||
      providerResult.content?.video_url ||
      providerResult.data?.content?.video_url ||
      providerResult.video_url ||
      ''

    await updateDb(async (db) => {
      const item = db.generationTasks.find(item => item.id === taskId)
      if (!item) return
      item.requestJson = {
        ...item.requestJson,
        providerQueryResult: providerResult
      }
      if (videoUrl || ['completed', 'succeeded', 'success'].includes(String(providerStatus).toLowerCase())) {
        item.status = 'succeeded'
      } else if (['failed', 'error'].includes(String(providerStatus).toLowerCase())) {
        item.status = 'failed'
        item.errorMessage = providerResult.message || providerResult.error?.message || 'Video generation failed'
      }
      item.updatedAt = new Date().toISOString()
    })

    return sendJson(res, 200, { code: 200, data: providerResult, task: publicTask({ ...task, status: videoUrl ? 'succeeded' : task.status }) })
  }

  return false
}
