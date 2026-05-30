import { updateDb } from '../db.js'
import { createId } from './http.js'

export const writeLog = async ({ userId = '', projectId = '', action, level = 'info', message = '', metadata = {} }) => {
  const now = new Date().toISOString()
  await updateDb(async (db) => {
    db.operationLogs.push({
      id: createId('log'),
      userId,
      projectId,
      action,
      level,
      message,
      metadata,
      createdAt: now
    })
  })
}
