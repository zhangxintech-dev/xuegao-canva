<template>
  <div class="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center px-4">
    <div class="w-full max-w-sm bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl p-6 shadow-sm">
      <div class="text-center mb-6">
        <img src="../assets/logo.png" alt="Logo" class="w-14 h-14 mx-auto mb-3" />
        <h1 class="text-xl font-semibold text-[var(--text-primary)]">
          {{ isRegisterMode ? '注册雪糕画布' : '登录雪糕画布' }}
        </h1>
        <p class="text-sm text-[var(--text-secondary)] mt-1">
          {{ isRegisterMode ? '创建账号，开始保存云端项目' : '进入你的云端项目与协同空间' }}
        </p>
      </div>

      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div v-if="isRegisterMode">
          <label class="text-xs text-[var(--text-secondary)] mb-1 block">昵称</label>
          <input
            v-model="name"
            type="text"
            autocomplete="name"
            class="w-full px-3 py-2 text-sm bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg outline-none focus:border-[var(--accent-color)] text-[var(--text-primary)]"
            placeholder="给自己取个名字"
          />
        </div>

        <div>
          <label class="text-xs text-[var(--text-secondary)] mb-1 block">邮箱</label>
          <input
            v-model="email"
            type="email"
            autocomplete="email"
            class="w-full px-3 py-2 text-sm bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg outline-none focus:border-[var(--accent-color)] text-[var(--text-primary)]"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label class="text-xs text-[var(--text-secondary)] mb-1 block">密码</label>
          <input
            v-model="password"
            type="password"
            :autocomplete="isRegisterMode ? 'new-password' : 'current-password'"
            class="w-full px-3 py-2 text-sm bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg outline-none focus:border-[var(--accent-color)] text-[var(--text-primary)]"
            :placeholder="isRegisterMode ? '至少 6 位密码' : '请输入密码'"
          />
        </div>

        <div v-if="isRegisterMode">
          <label class="text-xs text-[var(--text-secondary)] mb-1 block">确认密码</label>
          <input
            v-model="confirmPassword"
            type="password"
            autocomplete="new-password"
            class="w-full px-3 py-2 text-sm bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg outline-none focus:border-[var(--accent-color)] text-[var(--text-primary)]"
            placeholder="再次输入密码"
          />
        </div>

        <button
          type="submit"
          :disabled="authStore.loading"
          class="w-full h-10 rounded-xl bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ submitText }}
        </button>
      </form>

      <div class="mt-4 text-center">
        <button
          type="button"
          class="text-sm text-[var(--accent-color)] hover:text-[var(--accent-hover)]"
          @click="toggleMode"
        >
          {{ isRegisterMode ? '已有账号？去登录' : '没有账号？立即注册' }}
        </button>
      </div>

      <p class="text-xs text-[var(--text-secondary)] mt-4 text-center">
        账号和额度由云端后台统一管理，未注册用户不能使用。
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/pinia'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const isRegisterMode = ref(false)
const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')

const submitText = computed(() => {
  if (authStore.loading) return isRegisterMode.value ? '注册中...' : '登录中...'
  return isRegisterMode.value ? '注册并进入' : '登录'
})

const toggleMode = () => {
  isRegisterMode.value = !isRegisterMode.value
  password.value = ''
  confirmPassword.value = ''
}

const handleSubmit = async () => {
  if (!email.value.trim()) {
    window.$message?.warning('请输入邮箱')
    return
  }

  if (!password.value.trim()) {
    window.$message?.warning('请输入密码')
    return
  }

  if (isRegisterMode.value && password.value.length < 6) {
    window.$message?.warning('密码至少 6 位')
    return
  }

  if (isRegisterMode.value && password.value !== confirmPassword.value) {
    window.$message?.warning('两次输入的密码不一致')
    return
  }

  try {
    if (isRegisterMode.value) {
      await authStore.register({
        name: name.value.trim(),
        email: email.value.trim(),
        password: password.value
      })
    } else {
      await authStore.login({
        email: email.value.trim(),
        password: password.value
      })
    }
    const redirect = route.query.redirect || '/'
    router.replace(String(redirect))
  } catch (error) {
    window.$message?.error(error.message || (isRegisterMode.value ? '注册失败' : '登录失败'))
  }
}
</script>
