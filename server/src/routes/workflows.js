import fs from 'node:fs/promises'
import path from 'node:path'
import { config } from '../config.js'
import { readDb, updateDb } from '../db.js'
import { createId, HttpError, readJsonBody, sendJson } from '../lib/http.js'
import { writeLog } from '../lib/log.js'
import { isAdminUser, requireAuth } from '../middleware/auth.js'

const normalizeVisibility = (value) => value === 'public' ? 'public' : 'personal'

const publicWorkflow = (workflow) => ({
  id: workflow.id,
  ownerId: workflow.ownerId,
  name: workflow.name,
  thumbnail: workflow.thumbnail || '',
  visibility: workflow.visibility || 'personal',
  nodes: workflow.nodes || [],
  edges: workflow.edges || [],
  viewport: workflow.viewport || {},
  isCustomPublic: workflow.visibility === 'public',
  createdAt: workflow.createdAt,
  updatedAt: workflow.updatedAt
})

const parseDataUrl = (value) => {
  const match = String(value || '').match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return null
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64')
  }
}

const extensionFromMime = (mimeType) => {
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/webp') return 'webp'
  if (mimeType === 'image/gif') return 'gif'
  if (mimeType === 'video/mp4') return 'mp4'
  if (mimeType === 'video/webm') return 'webm'
  return 'png'
}

const dataUrlFromMask = (value) => {
  if (!value || typeof value !== 'string') return ''
  if (value.startsWith('data:')) return value
  if (/^[A-Za-z0-9+/=]+$/.test(value) && value.length > 64) return `data:image/png;base64,${value}`
  return ''
}

const createWorkflowAsset = async ({ db, userId, node, key, dataUrl }) => {
  const parsed = parseDataUrl(dataUrl)
  if (!parsed) return null
  const now = new Date().toISOString()
  const assetId = createId('asset')
  const fileName = `${assetId}.${extensionFromMime(parsed.mimeType)}`
  await fs.writeFile(path.join(config.uploadDir, fileName), parsed.buffer)
  const asset = {
    id: assetId,
    ownerId: userId,
    projectId: '',
    type: key === 'maskData' ? 'workflow_mask' : parsed.mimeType.startsWith('video/') ? 'saved_workflow_video' : 'saved_workflow_image',
    url: `${config.publicBaseUrl}/uploads/${fileName}`,
    storageKey: fileName,
    width: node.data?.width || null,
    height: node.data?.height || null,
    mimeType: parsed.mimeType,
    sizeBytes: parsed.buffer.length,
    createdAt: now
  }
  db.assets.push(asset)
  return asset
}

const persistWorkflowAssets = async ({ db, userId, nodes = [] }) => {
  const persisted = []
  for (const node of nodes) {
    const data = { ...(node.data || {}) }
    const nextNode = { ...node, data }

    for (const key of ['url', 'base64', 'thumbnail']) {
      const value = data[key]
      if (typeof value !== 'string' || !value.startsWith('data:')) continue
      const asset = await createWorkflowAsset({ db, userId, node: nextNode, key, dataUrl: value })
      if (!asset) continue
      if (key === 'base64') {
        data.base64AssetId = asset.id
        delete data.base64
      } else {
        data[key] = asset.url
        data[`${key}AssetId`] = asset.id
      }
      if (key === 'url') data.assetId = asset.id
    }

    const maskDataUrl = dataUrlFromMask(data.maskData)
    if (maskDataUrl) {
      const asset = await createWorkflowAsset({ db, userId, node: nextNode, key: 'maskData', dataUrl: maskDataUrl })
      if (asset) {
        data.maskAssetId = asset.id
        data.maskUrl = asset.url
        delete data.maskData
      }
    }

    persisted.push(nextNode)
  }
  return persisted
}

const findThumbnail = (nodes = []) => {
  const mediaNode = [...nodes]
    .filter(node => (node.type === 'image' || node.type === 'video') && (node.data?.thumbnail || node.data?.url))
    .sort((a, b) => (b.data?.updatedAt || 0) - (a.data?.updatedAt || 0))[0]
  return mediaNode?.data?.thumbnail || mediaNode?.data?.url || ''
}

export const handleWorkflowsRoute = async (req, res, pathname) => {
  if (!pathname.startsWith('/api/workflows')) return false

  const user = await requireAuth(req)
  const authDb = await readDb()
  const isAdmin = isAdminUser(user, authDb)

  if (req.method === 'GET' && pathname === '/api/workflows') {
    const workflows = authDb.savedWorkflows
      .filter(workflow => workflow.ownerId === user.id || workflow.visibility === 'public')
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .map(publicWorkflow)
    return sendJson(res, 200, { code: 200, data: { workflows } })
  }

  if (req.method === 'POST' && pathname === '/api/workflows') {
    const body = await readJsonBody(req)
    const now = new Date().toISOString()
    const workflow = await updateDb(async (db) => {
      const nodes = await persistWorkflowAssets({ db, userId: user.id, nodes: body.nodes || [] })
      const item = {
        id: body.id || createId('workflow'),
        ownerId: user.id,
        name: body.name || '未命名工作流',
        thumbnail: body.thumbnail || findThumbnail(nodes),
        visibility: normalizeVisibility(body.visibility),
        nodes,
        edges: body.edges || [],
        viewport: body.viewport || {},
        createdAt: now,
        updatedAt: now
      }
      db.savedWorkflows.unshift(item)
      return item
    })
    await writeLog({ userId: user.id, action: 'workflow.create', message: `Created workflow ${workflow.name}` })
    return sendJson(res, 200, { code: 200, data: publicWorkflow(workflow) })
  }

  const match = pathname.match(/^\/api\/workflows\/([^/]+)$/)
  if (!match) return false
  const workflowId = match[1]

  if (req.method === 'PATCH') {
    const body = await readJsonBody(req)
    const workflow = await updateDb(async (db) => {
      const item = db.savedWorkflows.find(workflow => workflow.id === workflowId)
      if (!item) throw new HttpError(404, 'Workflow not found')
      if (item.ownerId !== user.id && !isAdmin) throw new HttpError(403, 'Only owner or admin can update workflow')
      if (body.name !== undefined) item.name = String(body.name || '').trim() || item.name
      if (body.visibility !== undefined) item.visibility = normalizeVisibility(body.visibility)
      if (body.nodes || body.edges || body.viewport) {
        item.nodes = await persistWorkflowAssets({ db, userId: user.id, nodes: body.nodes || item.nodes || [] })
        item.edges = body.edges || item.edges || []
        item.viewport = body.viewport || item.viewport || {}
        item.thumbnail = body.thumbnail || findThumbnail(item.nodes)
      }
      item.updatedAt = new Date().toISOString()
      return item
    })
    await writeLog({ userId: user.id, action: 'workflow.update', message: `Updated workflow ${workflow.name}` })
    return sendJson(res, 200, { code: 200, data: publicWorkflow(workflow) })
  }

  if (req.method === 'DELETE') {
    await updateDb(async (db) => {
      const item = db.savedWorkflows.find(workflow => workflow.id === workflowId)
      if (!item) throw new HttpError(404, 'Workflow not found')
      if (item.ownerId !== user.id && !isAdmin) throw new HttpError(403, 'Only owner or admin can delete workflow')
      db.savedWorkflows = db.savedWorkflows.filter(workflow => workflow.id !== workflowId)
    })
    await writeLog({ userId: user.id, action: 'workflow.delete', message: 'Deleted workflow', metadata: { workflowId } })
    return sendJson(res, 200, { code: 200, data: { ok: true } })
  }

  return false
}
