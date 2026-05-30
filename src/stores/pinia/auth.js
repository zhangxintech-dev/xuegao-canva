import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import * as authApi from '@/api/auth'

const STORAGE_KEYS = {
  TOKEN: 'app-auth-token',
  REFRESH_TOKEN: 'app-refresh-token',
  USER: 'app-auth-user'
}

const getStored = (key, fallback = '') => {
  try {
    return localStorage.getItem(key) || fallback
  } catch {
    return fallback
  }
}

const getStoredJson = (key, fallback = null) => {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

const setStored = (key, value) => {
  try {
    if (value) {
      localStorage.setItem(key, value)
    } else {
      localStorage.removeItem(key)
    }
  } catch {
    // ignore
  }
}

const setStoredJson = (key, value) => {
  try {
    if (value) {
      localStorage.setItem(key, JSON.stringify(value))
    } else {
      localStorage.removeItem(key)
    }
  } catch {
    // ignore
  }
}

const normalizeAuthPayload = (payload, fallbackEmail = '') => {
  const data = payload?.data || payload || {}
  const user = data.user || data.profile || data.account || {
    id: data.userId || fallbackEmail || 'local-user',
    email: data.email || fallbackEmail,
    name: data.name || fallbackEmail || '本地用户'
  }

  return {
    token: data.accessToken || data.access_token || data.token || '',
    refreshToken: data.refreshToken || data.refresh_token || '',
    user
  }
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref(getStored(STORAGE_KEYS.TOKEN))
  const refreshTokenValue = ref(getStored(STORAGE_KEYS.REFRESH_TOKEN))
  const user = ref(getStoredJson(STORAGE_KEYS.USER))
  const loading = ref(false)
  const initialized = ref(false)

  const isAuthenticated = computed(() => !!token.value && !!user.value)
  const isAdmin = computed(() => !!user.value?.isAdmin)
  const displayName = computed(() => user.value?.name || user.value?.email || '未登录')

  const persistSession = (session) => {
    token.value = session.token
    refreshTokenValue.value = session.refreshToken || ''
    user.value = session.user
    setStored(STORAGE_KEYS.TOKEN, token.value)
    setStored(STORAGE_KEYS.REFRESH_TOKEN, refreshTokenValue.value)
    setStoredJson(STORAGE_KEYS.USER, user.value)
  }

  const clearSession = () => {
    token.value = ''
    refreshTokenValue.value = ''
    user.value = null
    setStored(STORAGE_KEYS.TOKEN, '')
    setStored(STORAGE_KEYS.REFRESH_TOKEN, '')
    setStoredJson(STORAGE_KEYS.USER, null)
  }

  const login = async ({ email, password }) => {
    loading.value = true
    try {
      const response = await authApi.login({ email, password })
      const session = normalizeAuthPayload(response, email)
      if (!session.token) {
        throw new Error('登录响应缺少 token')
      }
      persistSession(session)
      return session.user
    } catch (error) {
      throw error
    } finally {
      loading.value = false
    }
  }

  const register = async ({ email, password, name }) => {
    loading.value = true
    try {
      const response = await authApi.register({ email, password, name })
      const session = normalizeAuthPayload(response, email)
      if (!session.token) {
        throw new Error('注册响应缺少 token')
      }
      persistSession(session)
      return session.user
    } catch (error) {
      throw error
    } finally {
      loading.value = false
    }
  }

  const logout = async () => {
    try {
      if (token.value && !user.value?.isLocalFallback) {
        await authApi.logout()
      }
    } catch {
      // ignore logout API errors
    } finally {
      clearSession()
    }
  }

  const restoreSession = async () => {
    if (initialized.value) return
    initialized.value = true
    if (!token.value) return

    try {
      const response = await authApi.getCurrentUser()
      const data = response?.data || response
      user.value = data.user || data
      setStoredJson(STORAGE_KEYS.USER, user.value)
    } catch {
      clearSession()
    }
  }

  return {
    token,
    refreshToken: refreshTokenValue,
    user,
    loading,
    initialized,
    isAuthenticated,
    isAdmin,
    displayName,
    login,
    register,
    logout,
    restoreSession,
    clearSession
  }
})
