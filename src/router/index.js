/**
 * Router configuration | 路由配置
 */
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/pinia'

const AUTH_ENABLED = import.meta.env.VITE_AUTH_ENABLED !== 'false'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { guestOnly: true }
  },
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/Home.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/admin',
    name: 'Admin',
    component: () => import('../views/Admin.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/canvas/:id?',
    name: 'Canvas',
    component: () => import('../views/Canvas.vue'),
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

router.beforeEach(async (to) => {
  if (!AUTH_ENABLED) return true

  const authStore = useAuthStore()
  await authStore.restoreSession()

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return {
      name: 'Login',
      query: { redirect: to.fullPath }
    }
  }

  if (to.meta.requiresAdmin && !authStore.isAdmin) {
    return { name: 'Home' }
  }

  if (to.meta.guestOnly && authStore.isAuthenticated) {
    return { name: 'Home' }
  }

  return true
})

export default router
