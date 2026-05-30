import { readDb } from '../db.js'
import { HttpError } from '../lib/http.js'
import { verifyToken } from '../lib/token.js'

export const getBearerToken = (req) => {
  const header = req.headers.authorization || ''
  if (!header.startsWith('Bearer ')) return ''
  return header.slice('Bearer '.length)
}

export const requireAuth = async (req) => {
  const token = getBearerToken(req)
  const claims = verifyToken(token)
  const db = await readDb()
  const user = db.users.find(item => item.id === claims.sub)
  if (!user) throw new HttpError(401, 'User not found')

  req.user = {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl || ''
  }
  return req.user
}

export const getAdminEmails = () => String(process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(Boolean)

export const isAdminUser = (user, db) => {
  const firstUser = db.users[0]
  const adminEmails = getAdminEmails()
  return firstUser?.id === user.id || adminEmails.includes(user.email.toLowerCase())
}

export const requireAdmin = async (req) => {
  const user = await requireAuth(req)
  const db = await readDb()
  if (!isAdminUser(user, db)) throw new HttpError(403, 'Admin access required')

  req.adminUser = user
  return user
}

export const requireProjectAccess = async (req, projectId, roles = ['owner', 'editor', 'viewer']) => {
  const user = await requireAuth(req)
  const db = await readDb()
  const project = db.projects.find(item => item.id === projectId)
  if (!project) throw new HttpError(404, 'Project not found')

  const role = project.ownerId === user.id
    ? 'owner'
    : db.projectMembers.find(item => item.projectId === projectId && item.userId === user.id)?.role

  if (!role || !roles.includes(role)) {
    throw new HttpError(403, 'No project access')
  }

  req.project = project
  req.projectRole = role
  return { user, project, role }
}
