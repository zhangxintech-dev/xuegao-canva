import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { config } from './config.js'
import { ensureStorage, getDbMode, readDb } from './db.js'
import { sendError, sendJson } from './lib/http.js'
import { handleAuthRoute } from './routes/auth.js'
import { handleProjectsRoute } from './routes/projects.js'
import { handleAssetsRoute } from './routes/assets.js'
import { handleGenerationRoute } from './routes/generation.js'
import { handleModelsRoute } from './routes/models.js'
import { handleTeamsRoute } from './routes/teams.js'
import { handleQuotaRoute } from './routes/quota.js'
import { handleLogsRoute } from './routes/logs.js'
import { handleCollaborationRoute } from './routes/collaboration.js'
import { handleAdminRoute } from './routes/admin.js'
import { handleWorkflowsRoute } from './routes/workflows.js'

process.on('uncaughtException', (error) => {
  console.error('[server] uncaught exception')
  console.error(error)
})

process.on('unhandledRejection', (error) => {
  console.error('[server] unhandled rejection')
  console.error(error)
})

const serveUpload = (req, res, pathname) => {
  if (!pathname.startsWith('/uploads/')) return false

  const fileName = path.basename(pathname)
  const filePath = path.join(config.uploadDir, fileName)
  if (!fs.existsSync(filePath)) {
    sendJson(res, 404, { code: 404, message: 'File not found' })
    return true
  }

  const ext = path.extname(fileName).slice(1)
  const mimeType = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    mp4: 'video/mp4'
  }[ext] || 'application/octet-stream'

  res.writeHead(200, {
    'Content-Type': mimeType,
    'Access-Control-Allow-Origin': '*'
  })
  fs.createReadStream(filePath).pipe(res)
  return true
}

const handleRequest = async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const pathname = url.pathname

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')

  if (req.method === 'OPTIONS') {
    return sendJson(res, 200, { ok: true })
  }

  if (req.method === 'GET' && pathname === '/api/health') {
    return sendJson(res, 200, {
      code: 200,
      data: {
        ok: true,
        service: 'xuegao-canvas-api',
        dbMode: getDbMode(),
        time: new Date().toISOString()
      }
    })
  }

  if (req.method === 'GET' && pathname === '/api/debug/db') {
    try {
      const db = await readDb()
      return sendJson(res, 200, {
        code: 200,
        data: {
          dbMode: getDbMode(),
          users: db.users.length,
          projects: db.projects.length,
          modelConfigs: db.modelConfigs.length,
          operationLogs: db.operationLogs.length,
          firstUser: db.users[0] ? {
            id: db.users[0].id,
            email: db.users[0].email,
            hasPasswordHash: !!db.users[0].passwordHash,
            quotaTotal: db.users[0].quotaTotal,
            quotaUsed: db.users[0].quotaUsed
          } : null
        }
      })
    } catch (error) {
      console.error(`[${new Date().toISOString()}] GET ${pathname}`, error)
      return sendError(res, error)
    }
  }

  if (serveUpload(req, res, pathname)) return

  try {
    const handled =
      await handleAuthRoute(req, res, pathname) ||
      await handleAdminRoute(req, res, pathname) ||
      await handleTeamsRoute(req, res, pathname) ||
      await handleProjectsRoute(req, res, pathname) ||
      await handleWorkflowsRoute(req, res, pathname) ||
      await handleCollaborationRoute(req, res, pathname) ||
      await handleAssetsRoute(req, res, pathname) ||
      await handleGenerationRoute(req, res, pathname) ||
      await handleQuotaRoute(req, res, pathname) ||
      await handleLogsRoute(req, res, pathname) ||
      await handleModelsRoute(req, res, pathname)

    if (!handled && !res.headersSent && !res.writableEnded) {
      return sendJson(res, 404, { code: 404, message: 'Route not found' })
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ${req.method} ${pathname}`, error)
    return sendError(res, error)
  }
}

try {
  console.log(`[server] starting with ${getDbMode()} storage`)
  await ensureStorage()
  console.log('[server] storage ready')
} catch (error) {
  console.error('[server] failed to initialize storage')
  console.error(error)
  process.exit(1)
}

const server = http.createServer(handleRequest)
server.on('error', (error) => {
  console.error('[server] failed to listen')
  console.error(error)
  process.exit(1)
})
server.listen(config.port, config.host, () => {
  console.log(`Xuegao Canvas API listening on http://${config.host}:${config.port} (${getDbMode()} storage)`)
})
