import { readDb, updateDb } from '../db.js'
import { createId, HttpError, readJsonBody, sendJson } from '../lib/http.js'
import { writeLog } from '../lib/log.js'
import { requireAuth } from '../middleware/auth.js'

const publicTeam = (team, members = []) => ({
  id: team.id,
  name: team.name,
  ownerId: team.ownerId,
  members,
  createdAt: team.createdAt,
  updatedAt: team.updatedAt
})

const getTeamId = (pathname) => pathname.match(/^\/api\/teams\/([^/]+)/)?.[1] || ''

const requireTeamRole = async (req, teamId, roles = ['owner', 'editor', 'viewer']) => {
  const user = await requireAuth(req)
  const db = await readDb()
  const team = db.teams.find(item => item.id === teamId)
  if (!team) throw new HttpError(404, 'Team not found')
  const role = team.ownerId === user.id
    ? 'owner'
    : db.teamMembers.find(item => item.teamId === teamId && item.userId === user.id)?.role
  if (!role || !roles.includes(role)) throw new HttpError(403, 'No team access')
  return { user, team, role }
}

export const handleTeamsRoute = async (req, res, pathname) => {
  if (req.method === 'GET' && pathname === '/api/teams') {
    const user = await requireAuth(req)
    const db = await readDb()
    const memberTeamIds = db.teamMembers
      .filter(member => member.userId === user.id)
      .map(member => member.teamId)

    const teams = db.teams
      .filter(team => team.ownerId === user.id || memberTeamIds.includes(team.id))
      .map(team => publicTeam(team, db.teamMembers.filter(member => member.teamId === team.id)))
    return sendJson(res, 200, { code: 200, data: { teams } })
  }

  if (req.method === 'POST' && pathname === '/api/teams') {
    const user = await requireAuth(req)
    const body = await readJsonBody(req)
    const now = new Date().toISOString()

    const team = await updateDb(async (db) => {
      const item = {
        id: createId('team'),
        ownerId: user.id,
        name: body.name || '未命名团队',
        createdAt: now,
        updatedAt: now
      }
      db.teams.push(item)
      db.teamMembers.push({ teamId: item.id, userId: user.id, role: 'owner', createdAt: now })
      return item
    })

    await writeLog({ userId: user.id, action: 'team.create', message: `Created team ${team.name}`, metadata: { teamId: team.id } })
    return sendJson(res, 200, { code: 200, data: publicTeam(team, [{ teamId: team.id, userId: user.id, role: 'owner' }]) })
  }

  const teamId = getTeamId(pathname)
  if (!teamId) return false

  if (req.method === 'GET' && pathname === `/api/teams/${teamId}`) {
    const { team } = await requireTeamRole(req, teamId)
    const db = await readDb()
    const members = db.teamMembers.filter(member => member.teamId === teamId)
    return sendJson(res, 200, { code: 200, data: publicTeam(team, members) })
  }

  if (req.method === 'POST' && pathname === `/api/teams/${teamId}/members`) {
    const { user } = await requireTeamRole(req, teamId, ['owner'])
    const body = await readJsonBody(req)
    const email = String(body.email || '').trim().toLowerCase()
    const role = ['editor', 'viewer'].includes(body.role) ? body.role : 'viewer'
    const now = new Date().toISOString()

    const member = await updateDb(async (db) => {
      const target = db.users.find(item => item.email === email)
      if (!target) throw new HttpError(404, 'User not found')
      const existing = db.teamMembers.find(item => item.teamId === teamId && item.userId === target.id)
      if (existing) {
        existing.role = role
        return existing
      }
      const item = { teamId, userId: target.id, role, createdAt: now }
      db.teamMembers.push(item)
      return item
    })

    await writeLog({ userId: user.id, action: 'team.member.upsert', message: 'Updated team member', metadata: { teamId, member } })
    return sendJson(res, 200, { code: 200, data: member })
  }

  const memberMatch = pathname.match(/^\/api\/teams\/([^/]+)\/members\/([^/]+)$/)
  if (req.method === 'DELETE' && memberMatch) {
    const { user } = await requireTeamRole(req, teamId, ['owner'])
    const userId = memberMatch[2]
    await updateDb(async (db) => {
      db.teamMembers = db.teamMembers.filter(item => !(item.teamId === teamId && item.userId === userId))
    })
    await writeLog({ userId: user.id, action: 'team.member.remove', message: 'Removed team member', metadata: { teamId, userId } })
    return sendJson(res, 200, { code: 200, data: { ok: true } })
  }

  return false
}
