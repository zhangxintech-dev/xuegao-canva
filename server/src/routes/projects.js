import { readDb, updateDb } from '../db.js'
import { createId, HttpError, pick, readJsonBody, sendJson } from '../lib/http.js'
import { writeLog } from '../lib/log.js'
import { requireAuth, requireProjectAccess } from '../middleware/auth.js'

const defaultCanvas = () => ({
  nodes: [],
  edges: [],
  viewport: { x: 100, y: 50, zoom: 0.8 }
})

const publicProject = (project) => ({
  id: project.id,
  name: project.name,
  ownerId: project.ownerId,
  teamId: project.teamId || '',
  thumbnail: project.thumbnail || '',
  canvasData: project.canvasData || defaultCanvas(),
  createdAt: project.createdAt,
  updatedAt: project.updatedAt
})

const getProjectIdFromPath = (pathname) => {
  const match = pathname.match(/^\/api\/projects\/([^/]+)/)
  return match?.[1] || ''
}

export const handleProjectsRoute = async (req, res, pathname) => {
  if (req.method === 'GET' && pathname === '/api/projects') {
    const user = await requireAuth(req)
    const db = await readDb()
    const memberProjectIds = db.projectMembers
      .filter(member => member.userId === user.id)
      .map(member => member.projectId)

    const projects = db.projects
      .filter(project => project.ownerId === user.id || memberProjectIds.includes(project.id))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .map(publicProject)

    return sendJson(res, 200, { code: 200, data: { projects } })
  }

  if (req.method === 'POST' && pathname === '/api/projects') {
    const user = await requireAuth(req)
    const body = await readJsonBody(req)
    const now = new Date().toISOString()

    const project = await updateDb(async (db) => {
      const item = {
        id: body.id || createId('project'),
        ownerId: user.id,
        teamId: body.teamId || '',
        name: body.name || '未命名项目',
        thumbnail: body.thumbnail || '',
        canvasData: body.canvasData || defaultCanvas(),
        createdAt: now,
        updatedAt: now
      }
      db.projects.unshift(item)
      db.projectMembers.push({ projectId: item.id, userId: user.id, role: 'owner', createdAt: now })
      return item
    })

    await writeLog({ userId: user.id, projectId: project.id, action: 'project.create', message: `Created project ${project.name}` })
    return sendJson(res, 200, { code: 200, data: publicProject(project) })
  }

  const projectId = getProjectIdFromPath(pathname)
  if (!projectId) return false

  if (req.method === 'GET' && pathname === `/api/projects/${projectId}`) {
    const { project } = await requireProjectAccess(req, projectId)
    return sendJson(res, 200, { code: 200, data: publicProject(project) })
  }

  if (req.method === 'PATCH' && pathname === `/api/projects/${projectId}`) {
    await requireProjectAccess(req, projectId, ['owner', 'editor'])
    const body = await readJsonBody(req)
    const allowed = pick(body, ['name', 'thumbnail'])

    const project = await updateDb(async (db) => {
      const item = db.projects.find(project => project.id === projectId)
      if (!item) throw new HttpError(404, 'Project not found')
      Object.assign(item, allowed, { updatedAt: new Date().toISOString() })
      return item
    })

    return sendJson(res, 200, { code: 200, data: publicProject(project) })
  }

  if (req.method === 'DELETE' && pathname === `/api/projects/${projectId}`) {
    const { user, project } = await requireProjectAccess(req, projectId, ['owner'])
    await updateDb(async (db) => {
      if (project.ownerId !== user.id) throw new HttpError(403, 'Only owner can delete project')
      db.projects = db.projects.filter(item => item.id !== projectId)
      db.projectMembers = db.projectMembers.filter(item => item.projectId !== projectId)
      db.assets = db.assets.filter(item => item.projectId !== projectId)
      db.generationTasks = db.generationTasks.filter(item => item.projectId !== projectId)
    })

    return sendJson(res, 200, { code: 200, data: { ok: true } })
  }

  if (req.method === 'GET' && pathname === `/api/projects/${projectId}/canvas`) {
    const { project } = await requireProjectAccess(req, projectId)
    return sendJson(res, 200, { code: 200, data: project.canvasData || defaultCanvas() })
  }

  if (req.method === 'GET' && pathname === `/api/projects/${projectId}/members`) {
    await requireProjectAccess(req, projectId)
    const db = await readDb()
    const members = db.projectMembers.filter(member => member.projectId === projectId)
    return sendJson(res, 200, { code: 200, data: { members } })
  }

  if (req.method === 'POST' && pathname === `/api/projects/${projectId}/members`) {
    const { user } = await requireProjectAccess(req, projectId, ['owner'])
    const body = await readJsonBody(req)
    const email = String(body.email || '').trim().toLowerCase()
    const role = ['editor', 'viewer'].includes(body.role) ? body.role : 'viewer'
    const now = new Date().toISOString()

    const member = await updateDb(async (db) => {
      const target = db.users.find(item => item.email === email)
      if (!target) throw new HttpError(404, 'User not found')
      const existing = db.projectMembers.find(item => item.projectId === projectId && item.userId === target.id)
      if (existing) {
        existing.role = role
        return existing
      }
      const item = { projectId, userId: target.id, role, createdAt: now }
      db.projectMembers.push(item)
      return item
    })

    await writeLog({ userId: user.id, projectId, action: 'project.member.upsert', message: 'Updated project member', metadata: { member } })
    return sendJson(res, 200, { code: 200, data: member })
  }

  const projectMemberMatch = pathname.match(/^\/api\/projects\/([^/]+)\/members\/([^/]+)$/)
  if (req.method === 'DELETE' && projectMemberMatch) {
    const { user } = await requireProjectAccess(req, projectId, ['owner'])
    const userId = projectMemberMatch[2]
    await updateDb(async (db) => {
      db.projectMembers = db.projectMembers.filter(item => !(item.projectId === projectId && item.userId === userId))
    })
    await writeLog({ userId: user.id, projectId, action: 'project.member.remove', message: 'Removed project member', metadata: { userId } })
    return sendJson(res, 200, { code: 200, data: { ok: true } })
  }

  if (req.method === 'PUT' && pathname === `/api/projects/${projectId}/canvas`) {
    await requireProjectAccess(req, projectId, ['owner', 'editor'])
    const body = await readJsonBody(req)

    const canvasData = await updateDb(async (db) => {
      const project = db.projects.find(project => project.id === projectId)
      if (!project) throw new HttpError(404, 'Project not found')
      project.canvasData = {
        nodes: body.nodes || [],
        edges: body.edges || [],
        viewport: body.viewport || defaultCanvas().viewport
      }
      project.updatedAt = new Date().toISOString()
      db.workflowVersions.push({
        id: createId('workflow_version'),
        projectId,
        userId: req.user.id,
        version: db.workflowVersions.filter(item => item.projectId === projectId).length + 1,
        name: body.versionName || `Version ${new Date().toLocaleString()}`,
        canvasData: project.canvasData,
        createdAt: new Date().toISOString()
      })
      return project.canvasData
    })

    await writeLog({ userId: req.user.id, projectId, action: 'canvas.save', message: 'Saved canvas' })
    return sendJson(res, 200, { code: 200, data: canvasData })
  }

  if (req.method === 'GET' && pathname === `/api/projects/${projectId}/workflow-versions`) {
    await requireProjectAccess(req, projectId)
    const db = await readDb()
    const versions = db.workflowVersions
      .filter(item => item.projectId === projectId)
      .sort((a, b) => b.version - a.version)
      .map(item => ({
        id: item.id,
        projectId: item.projectId,
        userId: item.userId,
        version: item.version,
        name: item.name,
        createdAt: item.createdAt
      }))
    return sendJson(res, 200, { code: 200, data: { versions } })
  }

  const versionMatch = pathname.match(/^\/api\/projects\/([^/]+)\/workflow-versions\/([^/]+)$/)
  if (req.method === 'GET' && versionMatch) {
    await requireProjectAccess(req, projectId)
    const versionId = versionMatch[2]
    const db = await readDb()
    const version = db.workflowVersions.find(item => item.projectId === projectId && item.id === versionId)
    if (!version) throw new HttpError(404, 'Workflow version not found')
    return sendJson(res, 200, { code: 200, data: version })
  }

  return false
}
