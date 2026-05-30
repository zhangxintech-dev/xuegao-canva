<template>
  <!-- Workflow panel | 工作流浮动面板 -->
  <Transition name="panel-slide">
    <div v-if="visible" class="workflow-panel" v-click-outside="handleClickOutside">
      <!-- Header | 头部 -->
      <div class="panel-header">
        <div class="panel-tabs">
          <span 
            class="tab-item" 
            :class="{ active: activeTab === 'public' }"
            @click="activeTab = 'public'"
          >公共工作流</span>
          <span 
            class="tab-item" 
            :class="{ active: activeTab === 'my' }"
            @click="activeTab = 'my'"
          >我的工作流</span>
        </div>
        <button class="expand-btn" @click="visible = false">
          <n-icon :size="16"><CloseOutline /></n-icon>
        </button>
      </div>
      
      <!-- Content | 内容 -->
      <div class="panel-content">
        <!-- Public workflows | 公共工作流 -->
        <div v-if="activeTab === 'public'" class="workflow-grid">
          <div 
            v-for="workflow in publicWorkflows" 
            :key="workflow.id"
            class="workflow-card my-workflow-card"
            @click="handleOpenPublicWorkflow(workflow)"
          >
            <n-popconfirm
              v-if="canManageWorkflow(workflow)"
              positive-text="删除"
              negative-text="取消"
              @positive-click="handleDeletePublicWorkflow(workflow)"
            >
              <template #trigger>
                <button class="delete-workflow-btn" @click.stop title="删除公共工作流">
                  <n-icon :size="14"><TrashOutline /></n-icon>
                </button>
              </template>
              确认删除「{{ workflow.name }}」？
            </n-popconfirm>
            <div class="card-cover">
              <img
                v-if="getWorkflowCover(workflow) && !brokenThumbnails[workflow.id]"
                :src="getWorkflowCover(workflow)"
                :alt="workflow.name"
                class="cover-img"
                @error.stop="handleThumbnailError(workflow.id)"
              />
              <n-icon v-else :size="36" class="cover-icon">
                <component :is="getIcon(workflow.icon)" />
              </n-icon>
            </div>
            <div class="card-title">{{ workflow.name }}</div>
          </div>
        </div>
        
        <!-- My workflows | 我的工作流 -->
        <div v-else-if="myWorkflows.length > 0" class="workflow-grid">
          <div
            v-for="workflow in myWorkflows"
            :key="workflow.id"
            class="workflow-card my-workflow-card"
            @click="handleOpenMyWorkflow(workflow)"
          >
            <n-popconfirm
              positive-text="删除"
              negative-text="取消"
              @positive-click="handleDeleteMyWorkflow(workflow.id)"
            >
              <template #trigger>
                <button class="delete-workflow-btn" @click.stop title="删除工作流">
                  <n-icon :size="14"><TrashOutline /></n-icon>
                </button>
              </template>
              确认删除「{{ workflow.name }}」？
            </n-popconfirm>
            <button class="publish-workflow-btn" @click.stop="handlePublishWorkflow(workflow)" title="发布到公共工作流">
              发布
            </button>
            <div class="card-cover">
              <img
                v-if="workflow.thumbnail && !brokenThumbnails[workflow.id]"
                :src="workflow.thumbnail"
                :alt="workflow.name"
                class="cover-img"
                @error.stop="handleThumbnailError(workflow.id)"
              />
              <n-icon v-else :size="36" class="cover-icon">
                <FolderOpenOutline />
              </n-icon>
            </div>
            <div class="card-title">{{ workflow.name }}</div>
          </div>
        </div>

        <div v-else class="empty-state">
          <n-icon :size="36" class="text-gray-500">
            <FolderOpenOutline />
          </n-icon>
          <p class="text-gray-500 text-sm mt-2">暂无自定义工作流</p>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
/**
 * Workflow Panel Component | 工作流面板组件
 * 显示工作流模板列表，支持一键添加到画布
 */
import { computed, ref } from 'vue'
import { NIcon, NPopconfirm } from 'naive-ui'
import { useAuthStore } from '../stores/pinia'
import { 
  CloseOutline,
  GridOutline, 
  ImageOutline, 
  VideocamOutline,
  FolderOpenOutline,
  BookOutline,
  PersonOutline,
  CartOutline,
  ChatbubbleOutline,
  TrashOutline
} from '@vicons/ionicons5'
import { WORKFLOW_TEMPLATES } from '../config/workflows'
import {
  myWorkflows,
  publishedWorkflows,
  deletedPublicWorkflowIds,
  deleteMyWorkflow,
  publishWorkflow,
  deletePublicWorkflow
} from '../stores/workflows'

const props = defineProps({
  show: Boolean
})

const emit = defineEmits(['update:show', 'add-workflow', 'open-workflow'])

// Active tab | 当前标签
const activeTab = ref('public')
const brokenThumbnails = ref({})
const authStore = useAuthStore()
const canManageWorkflow = (workflow) => {
  if (workflow.isBuiltInPublic) return false
  if (authStore.isAdmin) return true
  return workflow.ownerId === authStore.user?.id || !workflow.ownerId
}

// Visible state | 显示状态
const visible = computed({
  get: () => props.show,
  set: (val) => emit('update:show', val)
})

// Public workflows | 公共工作流
const publicWorkflows = computed(() => {
  const hiddenIds = new Set(deletedPublicWorkflowIds.value)
  const builtInWorkflows = WORKFLOW_TEMPLATES
    .filter(workflow => !hiddenIds.has(workflow.id))
    .map(workflow => ({ ...workflow, isBuiltInPublic: true }))
  const customPublicWorkflows = publishedWorkflows.value.filter(workflow => !hiddenIds.has(workflow.id))
  return [...customPublicWorkflows, ...builtInWorkflows]
})

// Icon mapping | 图标映射
const iconMap = {
  GridOutline,
  ImageOutline,
  VideocamOutline,
  BookOutline,
  PersonOutline,
  ShoppingOutline: CartOutline,
  ChatbubbleOutline
}

const getIcon = (iconName) => {
  return iconMap[iconName] || GridOutline
}

const getWorkflowCover = (workflow) => workflow.cover || workflow.thumbnail || ''

// Handle add workflow | 处理添加工作流
const handleAddWorkflow = (workflow) => {
  // 直接添加工作流，节点内容由用户自己填写
  emit('add-workflow', { workflow, options: {} })
  visible.value = false
}

const handleOpenPublicWorkflow = (workflow) => {
  if (workflow.isCustomPublic) {
    emit('open-workflow', workflow)
    visible.value = false
    return
  }
  handleAddWorkflow(workflow)
}

const handleOpenMyWorkflow = (workflow) => {
  emit('open-workflow', workflow)
  visible.value = false
}

const handleDeleteMyWorkflow = (id) => {
  deleteMyWorkflow(id)
  window.$message?.success('工作流已删除')
}

const handlePublishWorkflow = async (workflow) => {
  await publishWorkflow(workflow)
  window.$message?.success('已发布到公共工作流')
}

const handleDeletePublicWorkflow = async (workflow) => {
  await deletePublicWorkflow(workflow)
  window.$message?.success('公共工作流已删除')
}

const handleThumbnailError = (id) => {
  brokenThumbnails.value = {
    ...brokenThumbnails.value,
    [id]: true
  }
}

// Handle click outside | 点击外部关闭
const handleClickOutside = () => {
  visible.value = false
}

// Custom directive | 自定义指令
const vClickOutside = {
  mounted(el, binding) {
    el._clickOutside = (e) => {
      if (!el.contains(e.target)) {
        binding.value()
      }
    }
    setTimeout(() => {
      document.addEventListener('click', el._clickOutside)
    }, 0)
  },
  unmounted(el) {
    document.removeEventListener('click', el._clickOutside)
  }
}
</script>

<style scoped>
/* Panel container | 面板容器 */
.workflow-panel {
  position: fixed;
  left: 72px;
  top: 100px;
  width: 520px;
  max-height: 70vh;
  background: var(--bg-secondary);
  backdrop-filter: blur(12px);
  border-radius: 16px;
  border: 1px solid var(--border-color);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  z-index: 100;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

:global(.dark) .workflow-panel {
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

/* Header | 头部 */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 12px;
  border-bottom: 1px solid var(--border-color);
}

.panel-tabs {
  display: flex;
  gap: 24px;
}

.tab-item {
  font-size: 15px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: color 0.2s;
  padding-bottom: 4px;
}

.tab-item:hover {
  color: var(--text-primary);
}

.tab-item.active {
  color: var(--text-primary);
  font-weight: 500;
}

.expand-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
  border: none;
  border-radius: 6px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.expand-btn:hover {
  background: var(--border-color);
  color: var(--text-primary);
}

/* Content | 内容区 */
.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

/* Workflow grid | 工作流网格 */
.workflow-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

/* Workflow card | 工作流卡片 */
.workflow-card {
  cursor: pointer;
  transition: transform 0.2s;
}

.my-workflow-card {
  position: relative;
}

.workflow-card:hover {
  transform: translateY(-2px);
}

.workflow-card:hover .card-cover {
  border-color: var(--accent-color);
}

.card-cover {
  aspect-ratio: 1;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  transition: border-color 0.2s;
  overflow: hidden;
  position: relative;
}

.cover-img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
  background: var(--bg-tertiary);
}

.cover-icon {
  color: var(--text-secondary);
}

.card-title {
  margin-top: 10px;
  font-size: 13px;
  color: var(--text-primary);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.delete-workflow-btn {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  cursor: pointer;
  z-index: 2;
}

.delete-workflow-btn:hover {
  color: #ef4444;
  background: var(--bg-tertiary);
}

.publish-workflow-btn {
  position: absolute;
  top: 6px;
  left: 6px;
  height: 26px;
  padding: 0 8px;
  border: none;
  border-radius: 6px;
  color: var(--accent-color);
  background: var(--bg-secondary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  cursor: pointer;
  z-index: 2;
  font-size: 12px;
}

.publish-workflow-btn:hover {
  background: var(--bg-tertiary);
}

/* Empty state | 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 24px;
  text-align: center;
  color: var(--text-secondary);
}

/* Transition | 过渡动画 */
.panel-slide-enter-active,
.panel-slide-leave-active {
  transition: all 0.25s ease;
}

.panel-slide-enter-from,
.panel-slide-leave-to {
  opacity: 0;
  transform: translateX(-12px);
}

/* Scrollbar | 滚动条 */
.panel-content::-webkit-scrollbar {
  width: 6px;
}

.panel-content::-webkit-scrollbar-track {
  background: transparent;
}

.panel-content::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 3px;
}

.panel-content::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}
</style>
