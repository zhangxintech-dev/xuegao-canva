import { readDb, updateDb } from '../db.js'
import { createId, HttpError, readJsonBody, sendJson } from '../lib/http.js'
import { writeLog } from '../lib/log.js'
import { requireAuth } from '../middleware/auth.js'

export const getQuota = async (userId) => {
  const db = await readDb()
  const user = db.users.find(item => item.id === userId)
  if (!user) throw new HttpError(404, 'User not found')
  return {
    userId,
    total: user.quotaTotal ?? 100,
    used: user.quotaUsed ?? 0,
    remaining: Math.max(0, (user.quotaTotal ?? 100) - (user.quotaUsed ?? 0))
  }
}

export const consumeQuota = async ({ userId, taskId = '', amount = 1, reason = 'model_call' }) => {
  return updateDb(async (db) => {
    const user = db.users.find(item => item.id === userId)
    if (!user) throw new HttpError(404, 'User not found')
    const total = user.quotaTotal ?? 100
    const used = user.quotaUsed ?? 0
    if (total - used < amount) {
      throw new HttpError(402, 'Insufficient quota')
    }
    user.quotaUsed = used + amount
    user.updatedAt = new Date().toISOString()
    const record = {
      id: createId('quota'),
      userId,
      taskId,
      amount,
      reason,
      createdAt: new Date().toISOString()
    }
    db.quotaRecords.push(record)
    return record
  })
}

export const handleQuotaRoute = async (req, res, pathname) => {
  if (req.method === 'GET' && pathname === '/api/quota/me') {
    const user = await requireAuth(req)
    const quota = await getQuota(user.id)
    return sendJson(res, 200, { code: 200, data: quota })
  }

  if (req.method === 'GET' && pathname === '/api/quota/records') {
    const user = await requireAuth(req)
    const db = await readDb()
    const records = db.quotaRecords
      .filter(record => record.userId === user.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    return sendJson(res, 200, { code: 200, data: { records } })
  }

  if (req.method === 'POST' && pathname === '/api/quota/adjust') {
    const user = await requireAuth(req)
    const body = await readJsonBody(req)
    const amount = Number(body.amount || 0)
    if (!amount) throw new HttpError(400, 'Amount is required')

    const quota = await updateDb(async (db) => {
      const target = db.users.find(item => item.id === (body.userId || user.id))
      if (!target) throw new HttpError(404, 'User not found')
      target.quotaTotal = Math.max(0, (target.quotaTotal ?? 100) + amount)
      target.updatedAt = new Date().toISOString()
      return {
        userId: target.id,
        total: target.quotaTotal,
        used: target.quotaUsed ?? 0,
        remaining: Math.max(0, target.quotaTotal - (target.quotaUsed ?? 0))
      }
    })

    await writeLog({ userId: user.id, action: 'quota.adjust', message: 'Adjusted quota', metadata: { amount, quota } })
    return sendJson(res, 200, { code: 200, data: quota })
  }

  return false
}
