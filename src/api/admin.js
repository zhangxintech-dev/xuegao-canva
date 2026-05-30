import { request } from '@/utils'

const ADMIN_BASE = '/api/admin'

export const getSummary = () => request({
  url: `${ADMIN_BASE}/summary`,
  method: 'get'
})

export const listUsers = () => request({
  url: `${ADMIN_BASE}/users`,
  method: 'get'
})

export const createUser = (data) => request({
  url: `${ADMIN_BASE}/users`,
  method: 'post',
  data
})

export const updateUserQuota = (userId, quotaTotal) => request({
  url: `${ADMIN_BASE}/users/${userId}/quota`,
  method: 'patch',
  data: { quotaTotal }
})

export const listProjects = () => request({
  url: `${ADMIN_BASE}/projects`,
  method: 'get'
})

export const listLogs = () => request({
  url: `${ADMIN_BASE}/logs`,
  method: 'get'
})

export const listModels = () => request({
  url: `${ADMIN_BASE}/models`,
  method: 'get'
})

export const createModel = (data) => request({
  url: `${ADMIN_BASE}/models`,
  method: 'post',
  data
})

export const scanModels = (data) => request({
  url: `${ADMIN_BASE}/models/scan`,
  method: 'post',
  data
})

export const updateModel = (modelId, data) => request({
  url: `${ADMIN_BASE}/models/${modelId}`,
  method: 'patch',
  data
})

export const checkModelHealth = (modelId) => request({
  url: `${ADMIN_BASE}/models/${modelId}/health`,
  method: 'post'
})

export const checkAllModelHealth = () => request({
  url: `${ADMIN_BASE}/models/health-check`,
  method: 'post'
})

export const deleteModel = (modelId) => request({
  url: `${ADMIN_BASE}/models/${modelId}`,
  method: 'delete'
})
