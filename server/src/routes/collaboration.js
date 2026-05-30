import { readDb, updateDb } from '../db.js'
import { createId, readJsonBody, sendJson } from '../lib/http.js'
import { writeLog } from '../lib/log.js'
import { requireProjectAccess } from '../middleware/auth.js'

export const handleCollaborationRoute = async (req, res, pathname) => {
  const match = pathname.match(/^\/api\/projects\/([^/]+)\/collaboration\/events$/)
  if (!match) return false

  const projectId = match[1]

  if (req.method === 'GET') {
    await requireProjectAccess(req, projectId)
    const db = await readDb()
    const events = (db.collaborationEvents || [])
      .filter(event => event.projectId === projectId)
      .slice(-100)
    return sendJson(res, 200, { code: 200, data: { events } })
  }

  if (req.method === 'POST') {
    const { user } = await requireProjectAccess(req, projectId, ['owner', 'editor'])
    const body = await readJsonBody(req)
    const event = {
      id: createId('collab_event'),
      projectId,
      userId: user.id,
      type: body.type || 'canvas:update',
      payload: body.payload || {},
      createdAt: new Date().toISOString()
    }

    await updateDb(async (db) => {
      if (!db.collaborationEvents) db.collaborationEvents = []
      db.collaborationEvents.push(event)
    })
    await writeLog({ userId: user.id, projectId, action: 'collaboration.event', message: event.type, metadata: event.payload })
    return sendJson(res, 200, { code: 200, data: event })
  }

  return false
}
