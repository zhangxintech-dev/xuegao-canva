import crypto from 'node:crypto'
import { config } from '../config.js'
import { HttpError } from './http.js'

const base64url = (input) => Buffer.from(input).toString('base64url')

const sign = (payload) => {
  return crypto
    .createHmac('sha256', config.jwtSecret)
    .update(payload)
    .digest('base64url')
}

export const createToken = (claims, expiresInSeconds = 60 * 60 * 24 * 7) => {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const now = Math.floor(Date.now() / 1000)
  const body = base64url(JSON.stringify({
    ...claims,
    iat: now,
    exp: now + expiresInSeconds
  }))
  const signature = sign(`${header}.${body}`)
  return `${header}.${body}.${signature}`
}

export const verifyToken = (token) => {
  if (!token) throw new HttpError(401, 'Missing token')

  const parts = token.split('.')
  if (parts.length !== 3) throw new HttpError(401, 'Invalid token')

  const [header, body, signature] = parts
  const expected = sign(`${header}.${body}`)
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new HttpError(401, 'Invalid token')
  }

  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new HttpError(401, 'Token expired')
  }
  return payload
}

export const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) => {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export const verifyPassword = (password, stored) => {
  const [salt, hash] = String(stored || '').split(':')
  if (!salt || !hash) return false
  const candidate = crypto.scryptSync(password, salt, 64)
  const expected = Buffer.from(hash, 'hex')
  return expected.length === candidate.length && crypto.timingSafeEqual(candidate, expected)
}
