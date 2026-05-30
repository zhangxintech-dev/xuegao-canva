import { readDb, updateDb } from '../db.js'
import { createId, HttpError, pick, readJsonBody, sendJson } from '../lib/http.js'
import { createToken, hashPassword, verifyPassword } from '../lib/token.js'
import { isAdminUser, requireAuth } from '../middleware/auth.js'

const publicUser = (user) => pick(user, ['id', 'email', 'name', 'avatarUrl', 'quotaTotal', 'quotaUsed', 'createdAt', 'updatedAt'])

const publicUserWithRole = (user, db) => ({
  ...publicUser(user),
  quotaTotal: user.quotaTotal ?? 100,
  quotaUsed: user.quotaUsed ?? 0,
  isAdmin: isAdminUser(user, db)
})

const createSession = (user, db) => ({
  user: {
    ...publicUserWithRole(user, db)
  },
  accessToken: createToken({ sub: user.id, email: user.email }),
  token: createToken({ sub: user.id, email: user.email })
})

export const handleAuthRoute = async (req, res, pathname) => {
  if (req.method === 'POST' && pathname === '/api/auth/register') {
    const body = await readJsonBody(req)
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    const name = String(body.name || email || '').trim()

    if (!email || !password) throw new HttpError(400, 'Email and password are required')

    const session = await updateDb(async (db) => {
      if (db.users.some(user => user.email === email)) {
        throw new HttpError(409, 'Email already registered')
      }

      const now = new Date().toISOString()
      const user = {
        id: createId('user'),
        email,
        name,
        passwordHash: hashPassword(password),
        avatarUrl: '',
        quotaTotal: Number(process.env.DEFAULT_USER_QUOTA || 100),
        quotaUsed: 0,
        createdAt: now,
        updatedAt: now
      }
      db.users.push(user)
      return createSession(user, db)
    })

    return sendJson(res, 200, { code: 200, data: session })
  }

  if (req.method === 'POST' && pathname === '/api/auth/login') {
    const body = await readJsonBody(req)
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    const db = await readDb()
    const user = db.users.find(item => item.email === email)

    if (!user) {
      throw new HttpError(401, 'Invalid email or password')
    }

    if (!user.passwordHash) {
      throw new HttpError(401, 'Account has no password. Please register again or reset this user in database.')
    }

    if (!verifyPassword(password, user.passwordHash)) {
      throw new HttpError(401, 'Invalid email or password')
    }

    return sendJson(res, 200, { code: 200, data: createSession(user, db) })
  }

  if (req.method === 'POST' && pathname === '/api/auth/logout') {
    await requireAuth(req)
    return sendJson(res, 200, { code: 200, data: { ok: true } })
  }

  if (req.method === 'POST' && pathname === '/api/auth/refresh') {
    const user = await requireAuth(req)
    const db = await readDb()
    return sendJson(res, 200, { code: 200, data: createSession(user, db) })
  }

  if (req.method === 'GET' && pathname === '/api/auth/me') {
    const user = await requireAuth(req)
    const db = await readDb()
    return sendJson(res, 200, { code: 200, data: { user: publicUserWithRole(user, db) } })
  }

  return false
}
