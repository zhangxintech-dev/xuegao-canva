import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(__dirname, '..')

export const config = {
  port: Number(process.env.PORT || 8787),
  host: process.env.HOST || '127.0.0.1',
  jwtSecret: process.env.JWT_SECRET || 'xuegao-canvas-local-secret',
  dbMode: process.env.DB_MODE === 'postgres' ? 'postgres' : 'json',
  adminEmail: process.env.ADMIN_EMAIL || 'zian@bencom.cn',
  dataDir: process.env.DATA_DIR || path.join(serverRoot, 'data'),
  uploadDir: process.env.UPLOAD_DIR || path.join(serverRoot, 'uploads'),
  publicBaseUrl: process.env.PUBLIC_BASE_URL || `http://127.0.0.1:${Number(process.env.PORT || 8787)}`
}
