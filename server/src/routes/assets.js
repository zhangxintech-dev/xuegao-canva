import fs from 'node:fs/promises'
import path from 'node:path'
import { config } from '../config.js'
import { readDb, updateDb } from '../db.js'
import { createId, HttpError, readJsonBody, sendJson } from '../lib/http.js'
import { requireAuth } from '../middleware/auth.js'

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
  return 'png'
}

export const handleAssetsRoute = async (req, res, pathname) => {
  if (req.method === 'POST' && (pathname === '/api/assets/upload' || pathname === '/api/assets/mask')) {
    const user = await requireAuth(req)
    const body = await readJsonBody(req)
    const parsed = parseDataUrl(body.dataUrl || body.base64 || body.content)
    if (!parsed) throw new HttpError(400, 'Asset upload expects a data URL')

    const now = new Date().toISOString()
    const assetId = createId('asset')
    const ext = extensionFromMime(parsed.mimeType)
    const fileName = `${assetId}.${ext}`
    const filePath = path.join(config.uploadDir, fileName)
    await fs.writeFile(filePath, parsed.buffer)

    const url = `${config.publicBaseUrl}/uploads/${fileName}`
    const asset = await updateDb(async (db) => {
      const item = {
        id: assetId,
        ownerId: user.id,
        projectId: body.projectId || '',
        type: pathname.endsWith('/mask') ? 'mask' : body.type || 'upload_image',
        url,
        storageKey: fileName,
        width: body.width || null,
        height: body.height || null,
        mimeType: parsed.mimeType,
        sizeBytes: parsed.buffer.length,
        createdAt: now
      }
      db.assets.push(item)
      return item
    })

    return sendJson(res, 200, { code: 200, data: asset })
  }

  const match = pathname.match(/^\/api\/assets\/([^/]+)$/)
  if (req.method === 'GET' && match) {
    await requireAuth(req)
    const assetId = match[1]
    const db = await readDb()
    const asset = db.assets.find(item => item.id === assetId)
    if (!asset) throw new HttpError(404, 'Asset not found')
    return sendJson(res, 200, { code: 200, data: asset })
  }

  return false
}
