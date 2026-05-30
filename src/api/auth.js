import { request } from '@/utils'

const AUTH_BASE = '/api/auth'

export const login = (data) => {
  return request({
    url: `${AUTH_BASE}/login`,
    method: 'post',
    data
  })
}

export const register = (data) => {
  return request({
    url: `${AUTH_BASE}/register`,
    method: 'post',
    data
  })
}

export const logout = () => {
  return request({
    url: `${AUTH_BASE}/logout`,
    method: 'post'
  })
}

export const refreshToken = () => {
  return request({
    url: `${AUTH_BASE}/refresh`,
    method: 'post'
  })
}

export const getCurrentUser = () => {
  return request({
    url: `${AUTH_BASE}/me`,
    method: 'get'
  })
}
