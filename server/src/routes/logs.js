import { readDb } from '../db.js'
import { sendJson } from '../lib/http.js'
import { requireAuth } from '../middleware/auth.js'

export const handleLogsRoute = async (req, res, pathname) => {
  if (req.method !== 'GET' || pathname !== '/api/logs') return false

  const user = await requireAuth(req)
  const db = await readDb()
  const logs = db.operationLogs
    .filter(log => !log.userId || log.userId === user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 200)

  return sendJson(res, 200, { code: 200, data: { logs } })
}
