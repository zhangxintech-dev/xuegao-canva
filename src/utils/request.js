/**
 * HTTP Request Utility | HTTP 请求工具
 * Axios-based request with interceptors
 */

import axios from 'axios'

export const APP_API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL || 'http://127.0.0.1:8787'

// Create axios instance | 创建 axios 实例
const instance = axios.create({
  baseURL: APP_API_BASE_URL,
  timeout: 30000000
})

const isAppApiRequest = (url = '') => {
  return url.startsWith('/api/') || url.includes('/api/')
}

// Request interceptor | 请求拦截器
instance.interceptors.request.use(
  (config) => {
    const requestUrl = config.url || ''

    if (isAppApiRequest(requestUrl)) {
      const token = localStorage.getItem('app-auth-token') || ''
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`
      }
      return config
    }

    // Get current provider | 获取当前渠道
    const currentProvider = localStorage.getItem('api-provider') || 'xuegao'

    // Get API keys from new storage | 从新存储结构获取 API Keys
    let apiKey = ''
    try {
      const apiKeysJson = localStorage.getItem('api-keys-by-provider')
      const apiKeys = apiKeysJson ? JSON.parse(apiKeysJson) : {}
      apiKey = apiKeys[currentProvider] || ''
    } catch (e) {
      apiKey = ''
    }

    // Skip auth for certain endpoints | 跳过某些端点的认证
    const noAuthEndpoints = ['/model/page', '/model/fullName', '/model/types']
    const isNoAuth = noAuthEndpoints.some(ep => requestUrl.includes(ep))

    if (apiKey && !isNoAuth) {
      config.headers['Authorization'] = `Bearer ${apiKey}`
    }

    return config
  },
  (error) => {
    console.error('Request error:', error)
    return Promise.reject(error)
  }
)

// Response interceptor | 响应拦截器
instance.interceptors.response.use(
  (res) => {
    const { data, code, message } = res.data || {}
    
    // Handle stream response | 处理流响应
    if (res.config.responseType === 'stream') {
      return res.data
    }
    
    // Handle blob response | 处理 blob 响应
    if (res.data instanceof Blob) {
      return res.data
    }
    
    // Success response | 成功响应
    if (code === 200 || res.status === 200) {
      return res.data
    }
    
    // Error response | 错误响应
    window.$message?.error(message || 'Request failed')
    return Promise.reject(res.data)
  },
  (error) => {
    const { response } = error
    let message = error.message
    
    if (response) {
      const { status, data } = response
      message = data?.message ||
        data?.error?.message ||
        data?.error ||
        data?.msg ||
        error.message
      
      if (status === 401) {
        const isAppApi = isAppApiRequest(error.config?.url || '')
        window.$message?.error(isAppApi ? '登录已过期，请重新登录' : 'API Key 无效或已过期')
      } else if (status === 429) {
        window.$message?.error('请求过于频繁，请稍后再试')
      } else {
        window.$message?.error(message || '请求失败')
      }
    } else {
      const isAppApi = isAppApiRequest(error.config?.url || '')
      message = isAppApi
        ? `后端未连接，请先启动 API 服务：${APP_API_BASE_URL}`
        : (error.message || '网络错误')
      window.$message?.error(message)
    }
    
    error.message = message || error.message
    error.backendData = response?.data
    return Promise.reject(error)
  }
)

/**
 * Set API base URL | 设置 API 基础 URL
 * @param {string} url - Base URL
 */
export const setBaseUrl = (url) => {
  instance.defaults.baseURL = url
}

/**
 * Get current base URL | 获取当前基础 URL
 * @returns {string}
 */
export const getBaseUrl = () => {
  return instance.defaults.baseURL
}

export default instance
