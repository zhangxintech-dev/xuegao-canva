import { request } from '@/utils'

export const listModels = (type) => request({
  url: `/api/models/${type}`,
  method: 'get'
})

export const getHealth = () => request({
  url: '/api/health',
  method: 'get'
})
