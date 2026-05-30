<template>
  <div class="min-h-screen h-screen overflow-y-auto bg-[var(--bg-primary)]">
    <AppHeader>
      <template #right>
        <button
          @click="router.push('/')"
          class="px-3 py-1.5 text-sm rounded-lg border border-[var(--border-color)] hover:border-[var(--accent-color)] hover:text-[var(--accent-color)] transition-colors"
        >
          返回首页
        </button>
      </template>
    </AppHeader>

    <main class="max-w-6xl mx-auto px-4 py-8">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-[var(--text-primary)]">后台管理</h1>
          <p class="text-sm text-[var(--text-secondary)] mt-1">管理用户、项目、模型、配额与系统日志</p>
          <p class="text-xs mt-2">
            <span
              class="px-2 py-1 rounded-full"
              :class="modelStore.backendStatus.ok ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300'"
            >
              {{ adminBackendBadgeText }}
            </span>
          </p>
        </div>
        <button
          @click="loadAdminData"
          :disabled="loading"
          class="px-3 py-2 text-sm rounded-lg bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white transition-colors disabled:opacity-50"
        >
          {{ loading ? '刷新中...' : '刷新' }}
        </button>
      </div>

      <div v-if="errorMessage" class="mb-4 p-3 rounded-xl bg-red-50 text-red-600 border border-red-100 text-sm">
        {{ errorMessage }}
      </div>

      <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div v-for="card in summaryCards" :key="card.label" class="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl p-4">
          <p class="text-xs text-[var(--text-secondary)]">{{ card.label }}</p>
          <p class="text-2xl font-semibold text-[var(--text-primary)] mt-1">{{ card.value }}</p>
        </div>
      </div>

      <div class="flex gap-2 mb-4">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          @click="activeTab = tab.key"
          class="px-4 py-2 text-sm rounded-xl border transition-colors"
          :class="activeTab === tab.key ? 'bg-[var(--accent-color)] text-white border-[var(--accent-color)]' : 'bg-[var(--bg-secondary)] border-[var(--border-color)] hover:border-[var(--accent-color)]'"
        >
          {{ tab.label }}
        </button>
      </div>

      <section v-if="activeTab === 'users'" class="space-y-4">
        <div class="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl p-4">
          <h2 class="font-semibold text-[var(--text-primary)] mb-3">新增用户</h2>
          <div class="grid grid-cols-1 md:grid-cols-[1fr_1.4fr_1fr_0.8fr_auto] gap-3">
            <input v-model="userForm.name" class="admin-input" placeholder="昵称" />
            <input v-model="userForm.email" class="admin-input" placeholder="邮箱" />
            <input v-model="userForm.password" type="password" class="admin-input" placeholder="密码，至少 6 位" />
            <input v-model.number="userForm.quotaTotal" type="number" min="0" class="admin-input" placeholder="配额" />
            <button
              @click="createUser"
              class="px-4 py-2 rounded-lg bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white text-sm transition-colors"
            >
              创建用户
            </button>
          </div>
          <p class="text-xs text-[var(--text-secondary)] mt-3">前台注册用户会自动进入这里；这里也可以由管理员手动创建账号并分配额度。</p>
        </div>

        <div class="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl overflow-hidden">
          <div class="grid grid-cols-[1.5fr_1.5fr_1fr_1fr_1.2fr] gap-3 px-4 py-3 text-xs text-[var(--text-secondary)] border-b border-[var(--border-color)]">
            <span>用户</span>
            <span>邮箱</span>
            <span>配额</span>
            <span>已用</span>
            <span>操作</span>
          </div>
          <div v-for="user in users" :key="user.id" class="grid grid-cols-[1.5fr_1.5fr_1fr_1fr_1.2fr] gap-3 px-4 py-3 text-sm items-center border-b border-[var(--border-color)] last:border-b-0">
            <span class="text-[var(--text-primary)] truncate">{{ user.name || '未命名' }}</span>
            <span class="text-[var(--text-secondary)] truncate">{{ user.email }}</span>
            <input
              v-model.number="quotaDrafts[user.id]"
              type="number"
              min="0"
              class="w-full px-2 py-1 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] outline-none focus:border-[var(--accent-color)]"
            />
            <span class="text-[var(--text-secondary)]">{{ user.quotaUsed || 0 }}</span>
            <button
              @click="saveQuota(user)"
              class="px-3 py-1.5 rounded-lg bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white text-xs transition-colors"
            >
              保存配额
            </button>
          </div>
        </div>
      </section>

      <section v-if="activeTab === 'projects'" class="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl overflow-hidden">
        <div class="grid grid-cols-[1.6fr_1.4fr_0.8fr_0.8fr_1fr] gap-3 px-4 py-3 text-xs text-[var(--text-secondary)] border-b border-[var(--border-color)]">
          <span>项目</span>
          <span>拥有者</span>
          <span>节点</span>
          <span>连线</span>
          <span>更新时间</span>
        </div>
        <div v-for="project in projects" :key="project.id" class="grid grid-cols-[1.6fr_1.4fr_0.8fr_0.8fr_1fr] gap-3 px-4 py-3 text-sm border-b border-[var(--border-color)] last:border-b-0">
          <span class="text-[var(--text-primary)] truncate">{{ project.name }}</span>
          <span class="text-[var(--text-secondary)] truncate">{{ project.ownerEmail || project.ownerName || '-' }}</span>
          <span>{{ project.nodeCount }}</span>
          <span>{{ project.edgeCount }}</span>
          <span class="text-[var(--text-secondary)]">{{ formatDate(project.updatedAt) }}</span>
        </div>
      </section>

      <section v-if="activeTab === 'logs'" class="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl overflow-hidden">
        <div class="grid grid-cols-[1fr_1.3fr_2fr_1fr] gap-3 px-4 py-3 text-xs text-[var(--text-secondary)] border-b border-[var(--border-color)]">
          <span>动作</span>
          <span>用户</span>
          <span>信息</span>
          <span>时间</span>
        </div>
        <div v-for="log in logs" :key="log.id" class="grid grid-cols-[1fr_1.3fr_2fr_1fr] gap-3 px-4 py-3 text-sm border-b border-[var(--border-color)] last:border-b-0">
          <span class="text-[var(--accent-color)] truncate">{{ log.action }}</span>
          <span class="text-[var(--text-secondary)] truncate">{{ log.userEmail || log.userId || '-' }}</span>
          <span class="text-[var(--text-primary)] truncate">{{ log.message }}</span>
          <span class="text-[var(--text-secondary)]">{{ formatDate(log.createdAt) }}</span>
        </div>
      </section>

      <section v-if="activeTab === 'models'" class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            v-for="item in modelTypeCards"
            :key="item.type"
            @click="startCreateModel(item.type)"
            class="text-left bg-[var(--bg-secondary)] border rounded-2xl p-4 transition-colors"
            :class="item.configured ? 'border-sky-300/60 hover:border-[var(--accent-color)]' : 'border-amber-300/70 hover:border-amber-400'"
          >
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="font-semibold text-[var(--text-primary)]">{{ item.label }}</p>
                <p class="text-xs text-[var(--text-secondary)] mt-1">{{ item.description }}</p>
              </div>
              <span
                class="text-xs px-2 py-1 rounded-full shrink-0"
                :class="item.configured ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'"
              >
                {{ item.configured ? `${item.count} 个已启用` : '未配置' }}
              </span>
            </div>
          </button>
        </div>

        <div v-if="missingModelTypes.length" class="p-3 rounded-xl bg-amber-50 text-amber-700 border border-amber-100 text-sm dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-900/40">
          还需要配置：{{ missingModelTypes.map(item => item.label).join('、') }}。普通用户只能使用已配置且启用的类型。
        </div>

        <div class="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl p-4">
          <h2 class="font-semibold text-[var(--text-primary)] mb-3">
            {{ editingModelId ? '编辑云端模型' : `新增${modelTypeLabel(modelForm.type)}模型` }}
          </h2>
          <div class="flex flex-wrap gap-2 mb-3">
            <button
              v-for="preset in providerPresets"
              :key="preset.key"
              @click="applyProviderPreset(preset.key)"
              class="px-3 py-1.5 text-xs rounded-lg border transition-colors"
              :class="modelForm.provider === preset.key ? 'border-[var(--accent-color)] text-[var(--accent-color)] bg-sky-50' : 'border-[var(--border-color)] hover:border-[var(--accent-color)]'"
            >
              {{ preset.label }}
            </button>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select v-model="modelForm.type" class="admin-input">
              <option value="image">图片模型</option>
              <option value="video">视频模型</option>
              <option value="chat">问答模型</option>
            </select>
            <input v-model="modelForm.provider" class="admin-input" placeholder="渠道，如 xuegao/openai" />
            <input v-model="modelForm.displayName" class="admin-input" placeholder="显示名称" />
            <input v-model="modelForm.modelKey" class="admin-input" placeholder="模型 Key，如 doubao-seedream..." />
            <input v-model="modelForm.baseUrl" class="admin-input" placeholder="Base URL，如 https://api.xxx.com" />
            <input v-model="modelForm.endpoint" class="admin-input" :placeholder="modelForm.type === 'video' ? '视频生成端点，如 /v1/videos' : '端点，如 /v1/images/generations'" />
            <input v-if="modelForm.type === 'video'" v-model="modelForm.queryEndpoint" class="admin-input" placeholder="视频查询端点，如 /v1/videos/{taskId}" />
            <input v-model="modelForm.apiKey" type="password" class="admin-input md:col-span-2" :placeholder="editingModelId ? 'API Key 已保存在后端；不填则沿用原 Key' : 'API Key，只保存在后端'" />
            <button @click="scanModelConfigs" :disabled="scanningModels" class="px-4 py-2 rounded-lg border border-[var(--accent-color)] text-[var(--accent-color)] hover:bg-sky-50 text-sm transition-colors disabled:opacity-50">
              {{ scanningModels ? '扫描中...' : '扫描模型' }}
            </button>
            <button @click="checkAllModelHealth" :disabled="checkingAllModels" class="px-4 py-2 rounded-lg border border-[var(--accent-color)] text-[var(--accent-color)] hover:bg-sky-50 text-sm transition-colors disabled:opacity-50">
              {{ checkingAllModels ? '检测中...' : '检测全部模型' }}
            </button>
            <button @click="saveModelConfig" class="px-4 py-2 rounded-lg bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white text-sm transition-colors">
              {{ editingModelId ? '更新模型' : '保存模型' }}
            </button>
            <button v-if="!editingModelId && nextMissingModelType" @click="startCreateModel(nextMissingModelType.type)" class="px-4 py-2 rounded-lg border border-[var(--accent-color)] text-[var(--accent-color)] hover:bg-sky-50 text-sm transition-colors">
              配置{{ nextMissingModelType.label }}
            </button>
            <button v-if="editingModelId" @click="resetModelForm" class="px-4 py-2 rounded-lg border border-[var(--border-color)] hover:border-[var(--accent-color)] text-sm transition-colors">
              取消编辑
            </button>
          </div>
          <div v-if="scannedModels.length" class="mt-4 rounded-xl border border-[var(--border-color)] overflow-hidden">
            <div class="flex items-center justify-between gap-3 px-4 py-3 bg-[var(--bg-tertiary)] border-b border-[var(--border-color)]">
              <div>
                <p class="text-sm font-semibold text-[var(--text-primary)]">扫描到的模型</p>
                <p class="text-xs text-[var(--text-secondary)] mt-1">已按问答/生图/视频分类；勾选会加入对应类型预设，取消勾选会从用户可用预设中移除。</p>
              </div>
              <span class="text-xs text-[var(--text-secondary)]">{{ scannedModels.length }} 个</span>
            </div>
            <div class="max-h-96 overflow-y-auto">
              <div v-for="group in scannedModelGroups" :key="group.type" class="border-b border-[var(--border-color)] last:border-b-0">
                <div class="sticky top-0 z-10 flex items-center justify-between px-4 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border-color)]">
                  <span class="text-xs font-semibold text-[var(--text-primary)]">{{ group.label }}</span>
                  <span class="text-xs text-[var(--text-secondary)]">{{ group.models.length }} 个</span>
                </div>
                <label
                  v-for="model in group.models"
                  :key="`${group.type}-${model.key}`"
                  class="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-sky-50/60 dark:hover:bg-sky-900/10 transition-colors cursor-pointer"
                >
                  <div class="min-w-0">
                    <p class="font-medium text-[var(--text-primary)] truncate">
                      {{ model.label || model.key }}
                      <span class="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-300">
                        {{ modelTypeLabel(model.type) }}
                      </span>
                    </p>
                    <p class="text-xs text-[var(--text-secondary)] truncate">{{ model.key }}</p>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <span class="text-xs px-2 py-1 rounded-full" :class="isScannedModelEnabled(model) ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'">
                      {{ isScannedModelEnabled(model) ? '已加入预设' : '未加入' }}
                    </span>
                    <input
                      type="checkbox"
                      class="w-4 h-4 accent-[var(--accent-color)]"
                      :checked="isScannedModelEnabled(model)"
                      :disabled="syncingScannedModelKey === model.key"
                      @change="toggleScannedModel(model, $event.target.checked)"
                    />
                  </div>
                </label>
              </div>
            </div>
          </div>
          <div v-else-if="lastScanMessage" class="mt-4 p-3 rounded-xl border text-sm" :class="lastScanOk ? 'border-sky-100 bg-sky-50 text-sky-700 dark:border-sky-900/40 dark:bg-sky-900/20 dark:text-sky-200' : 'border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200'">
            {{ lastScanMessage }}
          </div>
          <div v-if="lastScanEndpoint" class="mt-2 text-xs text-[var(--text-secondary)] truncate">
            扫描地址：{{ lastScanEndpoint }}
          </div>
          <p class="text-xs text-[var(--text-secondary)] mt-3">保存后前端会从云端读取模型列表，用户无需在浏览器配置 API Key。已保存配置可在下方点击“编辑”回填。</p>
        </div>

        <div class="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl overflow-hidden">
          <div class="grid grid-cols-[0.6fr_0.9fr_1.1fr_1fr_0.9fr_0.7fr_1.3fr] gap-3 px-4 py-3 text-xs text-[var(--text-secondary)] border-b border-[var(--border-color)]">
            <span>类型</span>
            <span>渠道</span>
            <span>模型</span>
            <span>Base URL</span>
            <span>健康</span>
            <span>Key</span>
            <span>操作</span>
          </div>
          <div v-for="model in models" :key="model.id" class="grid grid-cols-[0.6fr_0.9fr_1.1fr_1fr_0.9fr_0.7fr_1.3fr] gap-3 px-4 py-3 text-sm items-center border-b border-[var(--border-color)] last:border-b-0">
            <span>{{ modelTypeLabel(model.type) }}</span>
            <span class="truncate">{{ model.provider }}</span>
            <span class="truncate">{{ model.displayName || model.modelKey }}</span>
            <span class="truncate text-[var(--text-secondary)]">{{ model.baseUrl || '-' }}</span>
            <span class="truncate" :title="model.healthMessage || ''">
              <span class="text-xs px-2 py-1 rounded-full" :class="modelHealthClass(model.healthStatus)">
                {{ modelHealthLabel(model.healthStatus) }}
              </span>
            </span>
            <span>{{ model.hasApiKey ? '已配置' : '未配置' }}</span>
            <div class="flex gap-2">
              <button @click="editModel(model)" class="px-2 py-1 rounded-lg border border-[var(--border-color)] hover:border-[var(--accent-color)] text-xs">
                编辑
              </button>
              <button @click="checkOneModelHealth(model)" :disabled="checkingModelId === model.id" class="px-2 py-1 rounded-lg border border-[var(--border-color)] hover:border-[var(--accent-color)] text-xs disabled:opacity-50">
                {{ checkingModelId === model.id ? '检测中' : '检测' }}
              </button>
              <button @click="toggleModel(model)" class="px-2 py-1 rounded-lg border border-[var(--border-color)] hover:border-[var(--accent-color)] text-xs">
                {{ model.enabled ? '停用' : '启用' }}
              </button>
              <button @click="removeModel(model)" class="px-2 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 text-xs">
                删除
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import * as adminApi from '../api/admin'
import { useModelStore } from '../stores/pinia'

const router = useRouter()
const modelStore = useModelStore()
const loading = ref(false)
const errorMessage = ref('')
const activeTab = ref('users')
const summary = ref({})
const users = ref([])
const projects = ref([])
const logs = ref([])
const models = ref([])
const quotaDrafts = ref({})
const userForm = ref({
  name: '',
  email: '',
  password: '',
  quotaTotal: 100
})
const scannedModels = ref([])
const selectedScannedModel = ref('')
const scanningModels = ref(false)
const syncingScannedModelKey = ref('')
const checkingAllModels = ref(false)
const checkingModelId = ref('')
const lastScanEndpoint = ref('')
const lastScanMessage = ref('')
const lastScanOk = ref(false)
const createDefaultModelForm = () => ({
  type: 'image',
  provider: 'openai',
  displayName: '',
  modelKey: '',
  baseUrl: 'https://api.openai.com',
  endpoint: '/v1/images/generations',
  queryEndpoint: '',
  apiKey: ''
})
const modelForm = ref(createDefaultModelForm())
const editingModelId = ref('')

const providerPresets = [
  { key: 'openai', label: 'OpenAI 官方', baseUrl: 'https://api.openai.com' },
  { key: 'xuegao', label: '雪糕代理', baseUrl: 'https://api.xuegao.site' },
  { key: 'custom', label: '自定义渠道', baseUrl: '' }
]

const endpointMap = {
  image: '/v1/images/generations',
  video: '/v1/videos',
  chat: '/v1/chat/completions'
}

const queryEndpointMap = {
  video: '/v1/videos/{taskId}'
}

const modelTypeOptions = [
  { type: 'chat', label: '问答', description: '用于提示词润色、文本生成、工作流分析' },
  { type: 'image', label: '生图', description: '用于文生图、图生图、图片编辑' },
  { type: 'video', label: '视频', description: '用于文生视频、图生视频' }
]

const openAIModelDefaults = {
  image: { modelKey: 'gpt-image-1', displayName: 'GPT Image 1' },
  chat: { modelKey: 'gpt-4o-mini', displayName: 'GPT-4o mini' },
  video: { modelKey: 'sora-2', displayName: 'Sora 2' }
}

const tabs = [
  { key: 'users', label: '用户管理' },
  { key: 'models', label: '模型配置' },
  { key: 'projects', label: '项目管理' },
  { key: 'logs', label: '操作日志' }
]

const summaryCards = computed(() => [
  { label: '用户', value: summary.value.users || 0 },
  { label: '项目', value: summary.value.projects || 0 },
  { label: '团队', value: summary.value.teams || 0 },
  { label: '资产', value: summary.value.assets || 0 },
  { label: '生成任务', value: summary.value.generationTasks || 0 }
])

const enabledModelCountByType = computed(() => {
  return models.value.reduce((result, model) => {
    if (model.enabled !== false) {
      result[model.type] = (result[model.type] || 0) + 1
    }
    return result
  }, {})
})

const modelTypeCards = computed(() => modelTypeOptions.map(item => {
  const count = enabledModelCountByType.value[item.type] || 0
  return {
    ...item,
    count,
    configured: count > 0
  }
}))

const missingModelTypes = computed(() => modelTypeCards.value.filter(item => !item.configured))
const nextMissingModelType = computed(() => missingModelTypes.value.find(item => item.type !== modelForm.value.type) || null)

const normalizeBaseUrl = (url = '') => String(url || '').trim().replace(/\/+$/, '')

const inferScannedType = (model = {}) => {
  const value = `${model.type || ''} ${model.key || ''} ${model.label || ''}`.toLowerCase()
  if (/(gpt-image|dall[-_]?e|imagen|image|img|seedream|seededit|flux|sdxl|stable[-_]?diffusion|kolors|recraft|ideogram|midjourney|\bmj\b|dreamina)/.test(value)) return 'image'
  if (/(sora|veo\d*|video|wan\d*|kling|hailuo|runway|luma|pika|vidu|minimax|cogvideo|seedance)/.test(value)) return 'video'
  return 'chat'
}

const normalizeScannedType = (modelOrType) => {
  if (typeof modelOrType === 'object') {
    return ['chat', 'image', 'video'].includes(modelOrType.type) ? modelOrType.type : inferScannedType(modelOrType)
  }
  return ['chat', 'image', 'video'].includes(modelOrType) ? modelOrType : 'chat'
}

const scannedModelGroups = computed(() => modelTypeOptions
  .map(typeOption => ({
    ...typeOption,
    models: scannedModels.value.filter(model => normalizeScannedType(model) === typeOption.type)
  }))
  .filter(group => group.models.length)
)

const findSavedScannedModel = (scannedModel) => {
  const baseUrl = normalizeBaseUrl(modelForm.value.baseUrl)
  const type = normalizeScannedType(scannedModel)
  return models.value.find(model =>
    model.type === type &&
    model.provider === modelForm.value.provider &&
    normalizeBaseUrl(model.baseUrl) === baseUrl &&
    model.modelKey === scannedModel.key
  )
}

const isScannedModelEnabled = (scannedModel) => {
  const saved = findSavedScannedModel(scannedModel)
  return !!saved && saved.enabled !== false
}

const adminBackendBadgeText = computed(() => {
  if (modelStore.backendStatus.ok) {
    return `后端已连接 · ${modelStore.backendStatus.dbMode}`
  }
  return `后端未连接 · ${modelStore.backendStatus.apiBaseUrl || 'http://127.0.0.1:8787'}`
})

const getErrorMessage = (error) => {
  const status = error?.response?.status || error?.backendData?.code
  if (status === 401) return '登录已过期，请重新登录'
  if (status === 403) return '当前账号不是管理员，请使用管理员账号登录'
  return error?.backendData?.message || error?.message || '请求失败'
}

const getScanErrorMessage = (error) => {
  const details = error?.backendData?.details
  const firstError = details?.errors?.find(item => item.message)
  const tried = details?.endpoints?.length ? `，已尝试 ${details.endpoints.length} 个地址` : ''
  const tail = firstError?.endpoint ? `：${firstError.endpoint} -> ${firstError.message}` : ''
  return `${getErrorMessage(error) || '扫描模型失败'}${tried}${tail}`
}

const unwrapList = (response, key) => {
  const data = response?.data || response || {}
  return data[key] || []
}

const loadAdminData = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const status = await modelStore.checkBackendStatus()
    if (!status.ok) {
      throw new Error(`后端没有启动，当前页面正在请求 ${status.apiBaseUrl || 'http://127.0.0.1:8787'}。请先运行：npm run docker:up`)
    }

    const requests = await Promise.allSettled([
      adminApi.getSummary(),
      adminApi.listUsers(),
      adminApi.listProjects(),
      adminApi.listLogs(),
      adminApi.listModels()
    ])
    const [summaryRes, usersRes, projectsRes, logsRes, modelsRes] = requests
    const failed = requests.find(result => result.status === 'rejected')
    if (failed) throw failed.reason

    summary.value = summaryRes.value?.data || summaryRes.value || {}
    users.value = unwrapList(usersRes.value, 'users')
    projects.value = unwrapList(projectsRes.value, 'projects')
    logs.value = unwrapList(logsRes.value, 'logs')
    models.value = unwrapList(modelsRes.value, 'models')
    quotaDrafts.value = Object.fromEntries(users.value.map(user => [user.id, user.quotaTotal ?? 100]))
  } catch (error) {
    errorMessage.value = getErrorMessage(error)
  } finally {
    loading.value = false
  }
}

const modelTypeLabel = (type) => ({
  image: '图片',
  video: '视频',
  chat: '问答'
}[type] || type)

const modelHealthLabel = (status) => ({
  healthy: '可用',
  unhealthy: '异常',
  checking: '检测中',
  unchecked: '未检测'
}[status] || '未检测')

const modelHealthClass = (status) => ({
  healthy: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  unhealthy: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  checking: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  unchecked: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'
}[status] || 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300')

const createUser = async () => {
  if (!userForm.value.email.trim()) {
    window.$message?.warning('请输入用户邮箱')
    return
  }
  if (!userForm.value.password || userForm.value.password.length < 6) {
    window.$message?.warning('密码至少 6 位')
    return
  }

  try {
    const response = await adminApi.createUser(userForm.value)
    const user = response?.data || response
    users.value = [user, ...users.value]
    quotaDrafts.value[user.id] = user.quotaTotal ?? 100
    summary.value = {
      ...summary.value,
      users: (summary.value.users || 0) + 1
    }
    userForm.value = {
      name: '',
      email: '',
      password: '',
      quotaTotal: 100
    }
    window.$message?.success('用户已创建')
  } catch (error) {
    window.$message?.error(getErrorMessage(error) || '用户创建失败')
  }
}

const resetModelForm = () => {
  modelForm.value = createDefaultModelForm()
  editingModelId.value = ''
  scannedModels.value = []
  selectedScannedModel.value = ''
  syncingScannedModelKey.value = ''
  lastScanEndpoint.value = ''
  lastScanMessage.value = ''
  lastScanOk.value = false
}

const startCreateModel = (type) => {
  resetModelForm()
  modelForm.value.type = type
  modelForm.value.endpoint = endpointMap[type] || ''
  modelForm.value.queryEndpoint = queryEndpointMap[type] || ''
  if (modelForm.value.provider === 'openai') {
    const defaults = openAIModelDefaults[type]
    modelForm.value.modelKey = defaults?.modelKey || ''
    modelForm.value.displayName = defaults?.displayName || ''
  }
}

const editModel = (model) => {
  editingModelId.value = model.id
  modelForm.value = {
    type: model.type || 'image',
    provider: model.provider || 'openai',
    displayName: model.displayName || model.modelKey || '',
    modelKey: model.modelKey || '',
    baseUrl: model.baseUrl || '',
    endpoint: model.endpoint || endpointMap[model.type] || '',
    queryEndpoint: model.queryEndpoint || queryEndpointMap[model.type] || '',
    apiKey: ''
  }
  scannedModels.value = []
  selectedScannedModel.value = ''
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const saveModelConfig = async () => {
  if (!modelForm.value.modelKey.trim()) {
    window.$message?.warning('请输入模型 Key')
    return
  }
  if (!modelForm.value.baseUrl.trim()) {
    window.$message?.warning('请输入 Base URL')
    return
  }
  try {
    const status = await modelStore.checkBackendStatus()
    if (!status.ok) throw new Error(`后端没有启动：${status.apiBaseUrl}`)
    const payload = { ...modelForm.value }
    if (editingModelId.value && !payload.apiKey.trim()) {
      delete payload.apiKey
    }
    const modelId = editingModelId.value
    const response = modelId
      ? await adminApi.updateModel(modelId, payload)
      : await adminApi.createModel(payload)
    const model = response?.data || response
    const verifyResponse = await adminApi.listModels()
    const persistedModels = unwrapList(verifyResponse, 'models')
    const persistedModel = persistedModels.find(item => item.id === model.id)
    if (!persistedModel) {
      throw new Error('模型接口已返回成功，但从数据库重新读取时没有找到该模型，请检查 PostgreSQL 写入。')
    }
    models.value = persistedModels
    const savedType = model.type
    resetModelForm()
    const nextType = modelTypeOptions.find(item =>
      item.type !== savedType &&
      !models.value.some(model => model.type === item.type && model.enabled !== false)
    )
    if (!modelId && nextType) {
      startCreateModel(nextType.type)
    }
    await modelStore.loadCloudModels()
    window.$message?.success(modelId ? '模型已更新' : (nextType ? `模型已保存，请继续配置${nextType.label}模型` : '模型已保存到云端'))
  } catch (error) {
    window.$message?.error(getErrorMessage(error) || '模型保存失败')
  }
}

const scanModelConfigs = async () => {
  scanningModels.value = true
  lastScanEndpoint.value = ''
  lastScanMessage.value = ''
  lastScanOk.value = false
  try {
    const response = await adminApi.scanModels(modelForm.value)
    scannedModels.value = unwrapList(response, 'models').map(model => {
      const normalized = {
        ...model,
        type: normalizeScannedType(model)
      }
      return normalized
    })
    lastScanEndpoint.value = response?.data?.endpoint || response?.endpoint || ''
    selectedScannedModel.value = scannedModels.value[0]?.key || ''
    if (selectedScannedModel.value) {
      const match = scannedModels.value[0]
      modelForm.value.modelKey = match.key
      modelForm.value.displayName = match.label || match.key
    }
    lastScanOk.value = true
    lastScanMessage.value = scannedModels.value.length
      ? ''
      : '接口连通了，但没有返回模型列表。请确认该渠道的扫描接口是否支持当前模型类型。'
    window.$message?.success(`扫描到 ${scannedModels.value.length} 个模型`)
  } catch (error) {
    scannedModels.value = []
    const details = error?.backendData?.details
    lastScanEndpoint.value = details?.endpoints?.join('，') || ''
    lastScanMessage.value = getScanErrorMessage(error)
    window.$message?.error(lastScanMessage.value)
  } finally {
    scanningModels.value = false
  }
}

const buildScannedModelPayload = (scannedModel, enabled = true) => ({
  type: normalizeScannedType(scannedModel),
  provider: modelForm.value.provider,
  modelKey: scannedModel.key,
  displayName: scannedModel.label || scannedModel.key,
  baseUrl: modelForm.value.baseUrl,
  endpoint: modelForm.value.endpoint,
  queryEndpoint: modelForm.value.queryEndpoint,
  apiKey: modelForm.value.apiKey,
  enabled
})

const toggleScannedModel = async (scannedModel, enabled) => {
  syncingScannedModelKey.value = scannedModel.key
  try {
    const saved = findSavedScannedModel(scannedModel)
    const response = saved
      ? await adminApi.updateModel(saved.id, enabled ? buildScannedModelPayload(scannedModel, true) : { enabled: false })
      : await adminApi.createModel(buildScannedModelPayload(scannedModel, enabled))
    const updated = response?.data || response
    const nextModels = await adminApi.listModels()
    models.value = unwrapList(nextModels, 'models')
    if (enabled) {
      modelForm.value.modelKey = updated.modelKey || scannedModel.key
      modelForm.value.displayName = updated.displayName || scannedModel.label || scannedModel.key
    }
    await modelStore.loadCloudModels()
    window.$message?.success(enabled ? '已加入预设模型' : '已从预设模型中移除')
  } catch (error) {
    window.$message?.error(getErrorMessage(error) || '预设模型更新失败')
  } finally {
    syncingScannedModelKey.value = ''
  }
}

const applyProviderPreset = (provider) => {
  const preset = providerPresets.find(item => item.key === provider)
  if (!preset) return
  modelForm.value.provider = provider
  if (preset.baseUrl) modelForm.value.baseUrl = preset.baseUrl
  modelForm.value.endpoint = endpointMap[modelForm.value.type] || modelForm.value.endpoint
  modelForm.value.queryEndpoint = queryEndpointMap[modelForm.value.type] || modelForm.value.queryEndpoint
  if (provider === 'openai') {
    const defaults = openAIModelDefaults[modelForm.value.type]
    modelForm.value.modelKey = defaults?.modelKey || ''
    modelForm.value.displayName = defaults?.displayName || defaults?.modelKey || ''
  }
  scannedModels.value = []
  selectedScannedModel.value = ''
}

watch(selectedScannedModel, (key) => {
  if (!key) return
  const match = scannedModels.value.find(model => model.key === key)
  if (!match) return
  modelForm.value.modelKey = match.key
  modelForm.value.displayName = match.label || match.key
})

watch(() => modelForm.value.type, (type) => {
  modelForm.value.endpoint = endpointMap[type] || ''
  modelForm.value.queryEndpoint = queryEndpointMap[type] || ''
  if (modelForm.value.provider === 'openai') {
    const defaults = openAIModelDefaults[type]
    modelForm.value.modelKey = defaults?.modelKey || ''
    modelForm.value.displayName = defaults?.displayName || ''
  }
  scannedModels.value = []
  selectedScannedModel.value = ''
})

const toggleModel = async (model) => {
  try {
    const response = await adminApi.updateModel(model.id, { enabled: !model.enabled })
    const updated = response?.data || response
    models.value = models.value.map(item => item.id === model.id ? { ...item, ...updated } : item)
    await modelStore.loadCloudModels()
  } catch (error) {
    window.$message?.error(error.message || '模型状态更新失败')
  }
}

const checkOneModelHealth = async (model) => {
  checkingModelId.value = model.id
  try {
    const response = await adminApi.checkModelHealth(model.id)
    const updated = response?.data || response
    models.value = models.value.map(item => item.id === model.id ? { ...item, ...updated } : item)
    await modelStore.loadCloudModels()
    window.$message?.success(updated.healthStatus === 'healthy' ? '模型检测通过' : `模型异常：${updated.healthMessage || '不可用'}`)
  } catch (error) {
    window.$message?.error(getErrorMessage(error) || '模型检测失败')
  } finally {
    checkingModelId.value = ''
  }
}

const checkAllModelHealth = async () => {
  checkingAllModels.value = true
  try {
    const response = await adminApi.checkAllModelHealth()
    const checkedModels = unwrapList(response, 'models')
    const checkedMap = new Map(checkedModels.map(model => [model.id, model]))
    models.value = models.value.map(model => checkedMap.get(model.id) || model)
    await modelStore.loadCloudModels()
    const healthyCount = checkedModels.filter(model => model.healthStatus === 'healthy').length
    window.$message?.success(`检测完成：${healthyCount}/${checkedModels.length} 个可用`)
  } catch (error) {
    window.$message?.error(getErrorMessage(error) || '模型检测失败')
  } finally {
    checkingAllModels.value = false
  }
}

const removeModel = async (model) => {
  try {
    await adminApi.deleteModel(model.id)
    models.value = models.value.filter(item => item.id !== model.id)
    await modelStore.loadCloudModels()
    window.$message?.success('模型已删除')
  } catch (error) {
    window.$message?.error(error.message || '模型删除失败')
  }
}

const saveQuota = async (user) => {
  try {
    const quotaTotal = Number(quotaDrafts.value[user.id] || 0)
    const response = await adminApi.updateUserQuota(user.id, quotaTotal)
    const updated = response?.data || response
    users.value = users.value.map(item => item.id === user.id ? { ...item, ...updated } : item)
    window.$message?.success('配额已更新')
  } catch (error) {
    window.$message?.error(error.message || '配额更新失败')
  }
}

const formatDate = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleString()
}

onMounted(loadAdminData)
</script>

<style scoped>
.admin-input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  outline: none;
}

.admin-input:focus {
  border-color: var(--accent-color);
}
</style>
