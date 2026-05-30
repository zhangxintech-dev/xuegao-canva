import { randomUUID } from 'node:crypto'

export class HttpError extends Error {
  constructor(status, message, details = null) {
    super(message)
    this.status = status
    this.details = details
  }
}

export const sendJson = (res, status, payload) => {
  if (res.headersSent || res.writableEnded) {
    return true
  }

  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS'
  })
  res.end(JSON.stringify(payload))
  return true
}

export const sendError = (res, error) => {
  if (res.headersSent || res.writableEnded) {
    return true
  }

  const status = error.status || 500
  const isDev = process.env.NODE_ENV !== 'production'
  return sendJson(res, status, {
    code: status,
    message: error.message || 'Internal Server Error',
    details: error.details || undefined,
    stack: isDev && status >= 500 ? error.stack : undefined
  })
}

export const readJsonBody = async (req) => {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(chunk)
  }

  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return {}

  try {
    return JSON.parse(raw)
  } catch {
    throw new HttpError(400, 'Invalid JSON body')
  }
}

export const createId = (prefix) => `${prefix}_${Date.now()}_${randomUUID().slice(0, 8)}`

export const pick = (object, keys) => {
  const result = {}
  keys.forEach((key) => {
    if (object[key] !== undefined) result[key] = object[key]
  })
  return result
}
