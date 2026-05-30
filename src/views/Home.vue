<template>
  <!-- Home page | 首页 -->
  <div class="min-h-screen h-screen overflow-y-auto bg-[var(--bg-primary)]">
    <!-- Header | 顶部导航 -->
    <AppHeader>
      <template #right>
        <div class="hidden sm:flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <span>{{ authStore.displayName }}</span>
          <span
            class="text-xs px-2 py-0.5 rounded-full"
            :class="backendBadgeClass"
            :title="backendBadgeTitle"
          >
            {{ backendBadgeText }}
          </span>
        </div>
        <button
          v-if="authStore.isAdmin"
          @click="router.push('/admin')"
          class="px-3 py-1.5 text-sm rounded-lg border border-[var(--border-color)] hover:border-[var(--accent-color)] hover:text-[var(--accent-color)] transition-colors"
          title="后台管理"
        >
          后台管理
        </button>
        <button
          @click="handleLogout"
          class="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
          title="退出登录"
        >
          <n-icon :size="20"><LogOutOutline /></n-icon>
        </button>
      </template>
    </AppHeader>

    <!-- Main content | 主要内容 -->
    <main class="max-w-5xl mx-auto px-4 py-8 md:py-16">
      <!-- Welcome section | 欢迎区域 -->
      <section class="text-center mb-12">
        <div class="flex items-center justify-center gap-4 mb-8">
          <img src="../assets/logo.png" alt="Logo" class="w-12 h-12 md:w-16 md:h-16" />
          <h1 class="text-2xl md:text-4xl font-bold text-[var(--text-primary)]">欢迎来到雪糕无限画布</h1>
        </div>

        <!-- Input area | 输入区域 -->
        <div class="max-w-2xl mx-auto">
          <div class="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] p-4 shadow-sm">
            <textarea
              v-model="inputText"
              placeholder="输入你的创意，开始新项目"
              class="w-full bg-transparent resize-none outline-none text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] min-h-[80px]"
              @keydown.enter.ctrl="handleCreateWithInput"
            />
            <div class="flex items-center justify-between mt-2">
              <div class="flex flex-wrap items-center gap-2">
                <button
                  @click="imageInputRef?.click()"
                  class="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                  title="添加参考图片"
                >
                  <n-icon :size="18"><ImageOutline /></n-icon>
                </button>
                <input ref="imageInputRef" type="file" accept="image/*" class="hidden" @change="handleImageUpload" />
                <n-dropdown :options="imageModelOptions" @select="selectedImageModel = $event">
                  <button class="px-2 py-1 text-xs rounded-lg border border-[var(--border-color)] hover:border-[var(--accent-color)] transition-colors max-w-[160px] truncate">
                    {{ selectedImageModelLabel }}
                  </button>
                </n-dropdown>
                <input
                  v-model="selectedSize"
                  placeholder="尺寸/比例，如自适应"
                  class="w-32 px-2 py-1 text-xs bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg outline-none focus:border-[var(--accent-color)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]"
                />
              </div>
              <div class="flex items-center gap-3">
                <button
                  @click="handleCreateWithInput"
                  class="w-8 h-8 rounded-xl bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] flex items-center justify-center transition-colors shadow-sm"
                  title="AI 生成"
                >
                  <n-icon :size="20" color="white"><SendOutline /></n-icon>
                </button>
              </div>
            </div>
          </div>

          <div v-if="inputImagePreview" class="mt-3 flex items-center gap-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-2">
            <img :src="inputImagePreview" alt="参考图" class="w-14 h-14 object-cover rounded-lg" />
            <div class="min-w-0 flex-1 text-left">
              <p class="text-sm text-[var(--text-primary)] truncate">{{ inputImageName }}</p>
              <p class="text-xs text-[var(--text-secondary)]">将作为新项目参考图</p>
            </div>
            <button @click="clearInputImage" class="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors">
              <n-icon :size="16"><TrashOutline /></n-icon>
            </button>
          </div>

          <!-- Quick suggestions | 快捷建议 -->
          <div class="flex flex-wrap items-center justify-center gap-2 mt-4">
            <span class="text-sm text-[var(--text-secondary)]">推荐：</span>
            <button
              v-for="tag in suggestions"
              :key="tag"
              @click="inputText = tag"
              class="px-3 py-1.5 text-sm rounded-full bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:border-[var(--accent-color)] transition-colors"
            >
              {{ tag }}
            </button>
            <button
              @click="refreshSuggestions"
              class="p-1.5 hover:bg-sky-50 text-sky-600 rounded-lg transition-colors"
              title="换一批推荐"
            >
              <n-icon :size="16"><RefreshOutline /></n-icon>
            </button>
          </div>
        </div>
      </section>

      <!-- Workflows section | 工作流区域 -->
      <section ref="projectsSection">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-[var(--text-primary)]">我的个人工作流</h2>
          <button
            @click="createNewProject"
            class="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white transition-colors shadow-sm"
          >
            <n-icon :size="16"><AddOutline /></n-icon>
            新建项目
          </button>
        </div>

        <!-- Empty state | 空状态 -->
        <div v-if="myProjects.length === 0" class="text-center py-12 bg-[var(--bg-secondary)] rounded-xl border border-dashed border-[var(--border-color)]">
          <n-icon :size="48" class="text-[var(--text-secondary)] mb-4"><FolderOutline /></n-icon>
          <p class="text-[var(--text-secondary)] mb-4">还没有工作流，创建一个开始吧</p>
          <button
            @click="createNewProject"
            class="px-4 py-2 text-sm rounded-lg bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white transition-colors shadow-sm"
          >
            创建第一个项目
          </button>
        </div>

        <!-- Projects grid | 项目网格 -->
        <div v-if="myProjects.length" class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div
            v-for="project in myProjects"
            :key="project.id"
            class="group relative"
          >
            <!-- Project card | 项目卡片 -->
            <div
              @click="openProject(project)"
              class="cursor-pointer"
            >
              <div
                class="aspect-video rounded-xl overflow-hidden bg-[var(--bg-tertiary)] mb-2 border border-[var(--border-color)] relative"
                @mouseenter="handleThumbnailHover(project, true)"
                @mouseleave="handleThumbnailHover(project, false)"
              >
                <!-- Thumbnail or placeholder | 缩略图或占位 -->
                <template v-if="project.thumbnail">
                  <!-- Video thumbnail | 视频缩略图 -->
                  <video
                    v-if="isVideoUrl(project.thumbnail)"
                    :ref="el => setVideoRef(project.id, el)"
                    :src="project.thumbnail"
                    class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    muted
                    loop
                    playsinline
                  />
                  <!-- Image thumbnail | 图片缩略图 -->
                  <img
                    v-else
                    :src="project.thumbnail"
                    :alt="project.name"
                    class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </template>
                <div v-else class="w-full h-full flex items-center justify-center">
                  <n-icon :size="32" class="text-[var(--text-secondary)]"><DocumentOutline /></n-icon>
                </div>

                <!-- Hover overlay | 悬浮遮罩 -->
                <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span class="text-white text-sm">打开项目</span>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <p class="text-sm text-[var(--text-primary)] truncate">{{ project.name }}</p>
                <span v-if="project.visibility === 'public'" class="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700">公开</span>
              </div>
              <p class="text-xs text-[var(--text-secondary)]">{{ formatDate(project.updatedAt) }}</p>
            </div>

            <!-- Project actions | 项目操作 -->
            <div v-if="canManageProject(project)" class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <n-dropdown :options="getProjectActions(project)" @select="(key) => handleProjectAction(key, project)" placement="bottom-end">
                <button
                  @click.stop
                  class="p-1.5 bg-white/90 dark:bg-gray-800/90 rounded-lg shadow hover:bg-white dark:hover:bg-gray-800 transition-colors"
                >
                  <n-icon :size="16"><EllipsisHorizontalOutline /></n-icon>
                </button>
              </n-dropdown>
            </div>
          </div>
        </div>

      </section>
    </main>

    <!-- Left sidebar | 左侧边栏 -->
    <aside class="fixed left-4 top-1/2 -translate-y-1/2 hidden md:flex flex-col gap-2 p-2 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] shadow-sm">
      <button
        @click="createNewProject"
        class="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
        title="新建项目"
      >
        <n-icon :size="20"><DocumentOutline /></n-icon>
      </button>
      <button
        @click="scrollToProjects"
        class="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
        title="我的项目"
      >
        <n-icon :size="20"><FolderOutline /></n-icon>
      </button>
    </aside>

    <!-- Rename modal | 重命名弹窗 -->
    <n-modal v-model:show="showRenameModal" preset="dialog" title="重命名项目">
      <n-input v-model:value="renameValue" placeholder="请输入项目名称" />
      <template #action>
        <n-button @click="showRenameModal = false">取消</n-button>
        <n-button type="primary" @click="confirmRename">确定</n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup>
/**
 * Home view component | 首页视图组件
 * Entry point with project list and creation input
 */
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { NIcon, NDropdown, NModal, NInput, NButton, useDialog } from 'naive-ui'
import {
  AddOutline,
  ImageOutline,
  SendOutline,
  RefreshOutline,
  DocumentOutline,
  FolderOutline,
  EllipsisHorizontalOutline,
  CreateOutline,
  CopyOutline,
  TrashOutline,
  LogOutOutline
} from '@vicons/ionicons5'
import {
  projects,
  initProjectsStore,
  createProject,
  deleteProject,
  duplicateProject,
  renameProject,
  setProjectVisibility
} from '../stores/projects'
import { useModelStore, useAuthStore } from '../stores/pinia'
import { generatePromptSuggestions } from '../utils/promptSuggestions'
import AppHeader from '../components/AppHeader.vue'

const router = useRouter()
const dialog = useDialog()
const modelStore = useModelStore()
const authStore = useAuthStore()

const currentUserId = computed(() => authStore.user?.id || '')
const myProjects = computed(() => projects.value.filter(project => project.ownerId === currentUserId.value || project.visibility !== 'public'))
const canManageProject = (project) => project.ownerId === currentUserId.value || !project.ownerId

const isApiConfigured = computed(() => modelStore.hasCloudImageModels)
const backendBadgeText = computed(() => {
  if (!modelStore.backendStatus.ok) return '后端未连接'
  return modelStore.backendStatus.dbMode === 'postgres' ? '云端 PG' : '云端 JSON'
})
const backendBadgeTitle = computed(() => {
  if (modelStore.backendStatus.ok) return `API：${modelStore.backendStatus.apiBaseUrl}`
  return `请先启动后端：${modelStore.backendStatus.apiBaseUrl || 'http://127.0.0.1:8787'}`
})
const backendBadgeClass = computed(() =>
  modelStore.backendStatus.ok
    ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'
    : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300'
)

// Video refs for hover play | 视频引用用于悬停播放
const videoRefs = new Map()

// Set video ref | 设置视频引用
const setVideoRef = (projectId, el) => {
  if (el) {
    videoRefs.set(projectId, el)
  } else {
    videoRefs.delete(projectId)
  }
}

// Handle thumbnail hover | 处理缩略图悬停
const handleThumbnailHover = (project, isHovering) => {
  if (!isVideoUrl(project.thumbnail)) return

  const video = videoRefs.get(project.id)
  if (!video) return

  if (isHovering) {
    video.play().catch(() => {
      // Ignore play errors (e.g., autoplay policy)
    })
  } else {
    video.pause()
    video.currentTime = 0 // Reset to start
  }
}

// Input state | 输入状态
const inputText = ref('')
const inputImagePreview = ref('')
const inputImageName = ref('')
const imageInputRef = ref(null)
const selectedImageModel = ref(modelStore.selectedImageModel || '')
const selectedSize = ref('自适应')

const imageModelOptions = computed(() => {
  const options = modelStore.allImageModelOptions || []
  return options.length > 0 ? options : [{ label: '未选择模型', key: '' }]
})

const selectedImageModelLabel = computed(() => {
  const match = imageModelOptions.value.find(item => item.key === selectedImageModel.value)
  return match?.label || selectedImageModel.value || '大模型'
})

const syncSelectedImageModel = () => {
  const availableOptions = imageModelOptions.value.filter(item => item.key)
  if (!availableOptions.length) {
    selectedImageModel.value = ''
    return
  }
  if (!availableOptions.some(item => item.key === selectedImageModel.value)) {
    selectedImageModel.value = modelStore.selectedImageModel || availableOptions[0].key
  }
}

watch(imageModelOptions, syncSelectedImageModel, { immediate: true })
watch(() => modelStore.selectedImageModel, syncSelectedImageModel)

const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const handleImageUpload = async (event) => {
  const file = event.target.files?.[0]
  if (!file) return
  try {
    inputImagePreview.value = await fileToBase64(file)
    inputImageName.value = file.name
  } catch {
    window.$message?.error('图片读取失败')
  } finally {
    event.target.value = ''
  }
}

const clearInputImage = () => {
  inputImagePreview.value = ''
  inputImageName.value = ''
}

// Rename modal state | 重命名弹窗状态
const showRenameModal = ref(false)
const renameValue = ref('')
const renameTargetId = ref(null)

const suggestions = ref(generatePromptSuggestions())

const refreshSuggestions = () => {
  suggestions.value = generatePromptSuggestions()
}

// Format date | 格式化日期
const formatDate = (date) => {
  if (!date) return ''
  const d = new Date(date)
  const now = new Date()
  const diff = now - d

  // Less than 1 minute | 小于1分钟
  if (diff < 60000) return '刚刚'
  // Less than 1 hour | 小于1小时
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  // Less than 1 day | 小于1天
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  // Less than 7 days | 小于7天
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`
  // Format as date | 格式化为日期
  return `${d.getMonth() + 1}/${d.getDate()}`
}

// Get project actions | 获取项目操作选项
const getProjectActions = (project) => {
  const actions = [
    { label: '重命名', key: 'rename', icon: () => h(NIcon, null, { default: () => h(CreateOutline) }) },
    {
      label: project.visibility === 'public' ? '取消公开' : '设为公共',
      key: project.visibility === 'public' ? 'makePersonal' : 'makePublic'
    },
    { label: '复制', key: 'duplicate', icon: () => h(NIcon, null, { default: () => h(CopyOutline) }) },
    { type: 'divider' },
    { label: '删除', key: 'delete', icon: () => h(NIcon, null, { default: () => h(TrashOutline) }) }
  ]
  return canManageProject(project) ? actions : []
}

// Handle project action | 处理项目操作
const handleProjectAction = (key, project) => {
  switch (key) {
    case 'rename':
      renameTargetId.value = project.id
      renameValue.value = project.name
      showRenameModal.value = true
      break
    case 'duplicate':
      const newId = duplicateProject(project.id)
      if (newId) {
        window.$message?.success('项目已复制')
      }
      break
    case 'makePublic':
      setProjectVisibility(project.id, 'public')
      window.$message?.success('已设为公共工作流')
      break
    case 'makePersonal':
      setProjectVisibility(project.id, 'personal')
      window.$message?.success('已取消公开')
      break
    case 'delete':
      dialog.warning({
        title: '删除项目',
        content: `确定要删除项目「${project.name}」吗？此操作不可恢复。`,
        positiveText: '删除',
        negativeText: '取消',
        onPositiveClick: () => {
          deleteProject(project.id)
          window.$message?.success('项目已删除')
        }
      })
      break
  }
}

// Confirm rename | 确认重命名
const confirmRename = () => {
  if (renameTargetId.value && renameValue.value.trim()) {
    renameProject(renameTargetId.value, renameValue.value.trim())
    window.$message?.success('已重命名')
  }
  showRenameModal.value = false
  renameTargetId.value = null
  renameValue.value = ''
}

// Check cloud availability before navigation | 跳转前检查云端可用性
const checkApiKeyAndNavigate = async (callback) => {
  if (!authStore.isAuthenticated) {
    dialog.warning({
      title: '请先登录',
      content: '未注册或未登录用户不能使用画布功能。',
      positiveText: '知道了'
    })
    return false
  }
  if (!isApiConfigured.value) {
    await modelStore.loadCloudModels()
    syncSelectedImageModel()
  }
  if (!isApiConfigured.value) {
    dialog.warning({
      title: '未配置云端模型',
      content: '没有读取到可用的生图模型。请确认管理员已配置并启用“生图模型”，然后刷新页面重试。',
      positiveText: '知道了'
    })
    return false
  }
  callback()
  return true
}

const handleLogout = async () => {
  await authStore.logout()
  router.push('/login')
}

// Create new project | 创建新项目
const createNewProject = async () => {
  await checkApiKeyAndNavigate(() => {
    const id = createProject('未命名项目')
    router.push(`/canvas/${id}`)
  })
}

// Create project with input text | 使用输入文本创建项目
const handleCreateWithInput = async () => {
  await checkApiKeyAndNavigate(() => {
    const name = inputText.value.trim() || '未命名项目'
    const id = createProject(name)
    const size = selectedSize.value.trim()
    const model = selectedImageModel.value || modelStore.selectedImageModel
    sessionStorage.setItem('ai-canvas-initial-options', JSON.stringify({
      prompt: inputText.value.trim(),
      image: inputImagePreview.value,
      imageName: inputImageName.value,
      model,
      size: !size || size === '自适应' ? 'auto' : size
    }))
    inputText.value = ''
    clearInputImage()
    router.push(`/canvas/${id}`)
  })
}

// Open existing project | 打开已有项目
const openProject = (project) => {
  checkApiKeyAndNavigate(() => {
    router.push(`/canvas/${project.id}`)
  })
}

// Check if URL is a video | 检查 URL 是否为视频
const isVideoUrl = (url) => {
  if (!url || typeof url !== 'string') return false
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv']
  return videoExtensions.some(ext => url.toLowerCase().includes(ext))
}

// Import h for render functions | 导入 h 用于渲染函数
import { h } from 'vue'

// Projects section ref | 项目区域引用
const projectsSection = ref(null)

// Scroll to projects section | 滚动到项目区域
const scrollToProjects = () => {
  if (projectsSection.value) {
    projectsSection.value.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

// Initialize projects store on mount | 挂载时初始化项目存储
onMounted(async () => {
  await modelStore.checkBackendStatus()
  initProjectsStore()
  await modelStore.loadCloudModels()
  syncSelectedImageModel()
})
</script>
