<template>
  <!-- Image node wrapper for hover area | 图片节点包裹层，扩展悬浮区域 -->
  <div class="image-node-wrapper" @mouseenter="showActions = true; showHandleMenu = true" @mouseleave="showActions = false; showHandleMenu = false">
    <!-- Image node | 图片节点 -->
    <div
      class="image-node bg-[var(--bg-secondary)] rounded-xl border min-w-[200px] max-w-[280px] relative transition-all duration-200"
      :class="data.selected ? 'border-1 border-blue-500 shadow-lg shadow-blue-500/20' : 'border border-[var(--border-color)]'">
      <!-- Header | 头部 -->
      <div class="px-3 py-2 border-b border-[var(--border-color)]">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span
              v-if="!isEditingLabel"
              @dblclick="startEditLabel"
              class="text-sm font-medium text-[var(--text-primary)] cursor-text hover:bg-[var(--bg-tertiary)] px-1 rounded transition-colors"
              title="双击编辑名称"
            >{{ data.label || '图像生成结果' }}</span>
            <input
              v-else
              ref="labelInputRef"
              v-model="editingLabelValue"
              @blur="finishEditLabel"
              @keydown.enter="finishEditLabel"
              @keydown.escape="cancelEditLabel"
              class="text-sm font-medium bg-[var(--bg-tertiary)] text-[var(--text-primary)] px-1 rounded outline-none border border-blue-500"
            />
            <!-- Public switch | 公开开关 -->
            <n-tooltip trigger="hover">
              <template #trigger>
                <button
                  class="flex items-center"
                  title="设置公开（可被 @ 引用）"
                >
                  <n-switch
                    :value="isPublic"
                    @update:value="handleTogglePublic"
                    size="small"
                  />
                </button>
              </template>
              {{ isPublic ? '已公开: ' + (data.label || '图片') : '点击公开（可被 @ 引用）' }}
            </n-tooltip>
          </div>
          <div class="flex items-center gap-1">
            <!-- Replace button | 替换按钮 -->
            <n-tooltip trigger="hover">
              <template #trigger>
                <button @click="showReplaceModal = true" class="p-1 hover:bg-[var(--bg-tertiary)] rounded transition-colors">
                  <n-icon :size="14">
                    <SwapHorizontalOutline />
                  </n-icon>
                </button>
              </template>
              替换图片
            </n-tooltip>
            <n-tooltip v-if="data.url" trigger="hover">
              <template #trigger>
                <button @click="handlePreview" class="p-1 hover:bg-[var(--bg-tertiary)] rounded transition-colors">
                  <n-icon :size="14">
                    <EyeOutline />
                  </n-icon>
                </button>
              </template>
              预览
            </n-tooltip>
            <n-tooltip v-if="data.url" trigger="hover">
              <template #trigger>
                <button @click="openImageEditor()" class="p-1 hover:bg-[var(--bg-tertiary)] rounded transition-colors">
                  <n-icon :size="14">
                    <ColorWandOutline />
                  </n-icon>
                </button>
              </template>
              图片编辑
            </n-tooltip>
            <n-tooltip v-if="data.url" trigger="hover">
              <template #trigger>
                <button @click="handleDownload" class="p-1 hover:bg-[var(--bg-tertiary)] rounded transition-colors">
                  <n-icon :size="14">
                    <DownloadOutline />
                  </n-icon>
                </button>
              </template>
              下载
            </n-tooltip>
            <n-tooltip trigger="hover">
              <template #trigger>
                <button @click="handleDuplicate" class="p-1 hover:bg-[var(--bg-tertiary)] rounded transition-colors">
                  <n-icon :size="14">
                    <CopyOutline />
                  </n-icon>
                </button>
              </template>
              复制节点
            </n-tooltip>
            <n-tooltip trigger="hover">
              <template #trigger>
                <button @click="handleDelete" class="p-1 hover:bg-[var(--bg-tertiary)] rounded transition-colors">
                  <n-icon :size="14">
                    <TrashOutline />
                  </n-icon>
                </button>
              </template>
              删除节点
            </n-tooltip>
          </div>
        </div>
        <!-- Model name | 模型名称 -->
        <div v-if="data.model" class="mt-1 text-xs text-[var(--text-secondary)] truncate">
          {{ data.model }}
        </div>
      </div>

      <!-- Image preview area | 图片预览区域 -->
      <div class="p-3">
        <!-- Loading state | 加载状态 -->
        <div v-if="data.loading"
          class="aspect-square rounded-xl bg-gradient-to-br from-cyan-400 via-blue-300 to-amber-200 flex flex-col items-center justify-center gap-3 relative overflow-hidden">
          <!-- Animated gradient overlay | 动画渐变遮罩 -->
          <div
            class="absolute inset-0 bg-gradient-to-br from-cyan-500/20 via-blue-400/20 to-amber-300/20 animate-pulse">
          </div>

          <!-- Loading image | 加载图片 -->
          <div class="relative z-10">
            <img src="../../assets/loading.webp" alt="Loading" class="w-14 h-12" />
          </div>

          <span class="text-sm text-white font-medium relative z-10">创作中</span>
        </div>

        <!-- Error state | 错误状态 -->
        <div v-else-if="data.error"
          class="aspect-square rounded-xl bg-red-50 dark:bg-red-900/20 flex flex-col items-center justify-center gap-2 border border-red-200 dark:border-red-800">
          <n-icon :size="32" class="text-red-500">
            <CloseCircleOutline />
          </n-icon>
          <span class="text-sm text-red-600 dark:text-red-400 text-center px-2">{{ data.error }}</span>
        </div>

        <!-- Image display | 图片显示 -->
        <div 
          v-else-if="data.url" 
          class="rounded-xl overflow-hidden relative" 
          ref="imageContainerRef"
        >
          <img 
            :src="data.url" 
            :alt="data.label" 
            class="w-full h-auto object-cover"
            :style="imageDisplayStyle"
            :class="{ 'pointer-events-none': isInpaintMode }"
          />
          
          <!-- Inpaint canvas with events | 涂抹画布（带事件） -->
          <canvas 
            v-if="isInpaintMode"
            ref="canvasRef"
            class="absolute inset-0 w-full h-full cursor-none z-10"
            @mousedown.stop.prevent="onCanvasPaint"
            @mousemove.stop="onCanvasMove"
            @mouseup.stop="onPaintEnd"
            @mouseleave="onPaintEnd"
          />
          
          <!-- Brush cursor | 画笔光标 -->
          <div 
            v-show="brushCursor.visible && isInpaintMode"
            class="absolute pointer-events-none border-2 border-red-500 rounded-full bg-red-400/25 transition-none"
            :style="{
              width: brushSize * 2 + 'px',
              height: brushSize * 2 + 'px',
              left: brushCursor.x - brushSize + 'px',
              top: brushCursor.y - brushSize + 'px'
            }"
          />
          
          <!-- Inpaint toolbar | 涂抹工具栏 -->
          <div 
            v-show="isInpaintMode"
            class="absolute top-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2 py-1 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-full shadow-md border border-gray-200/80 dark:border-gray-700 z-[9999]"
            @mousedown.stop
            @click.stop
          >
            <!-- Mode indicator | 模式指示 -->
            <div class="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 pr-1.5 border-r border-gray-200 dark:border-gray-600">
              <n-icon :size="12"><BrushOutline /></n-icon>
              <span>{{ editModeLabel }}</span>
            </div>
            <input
              v-if="currentEditMode === 'mark'"
              v-model="editPrompt"
              placeholder="说明要怎么修改..."
              class="w-32 px-2 py-0.5 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded outline-none focus:border-red-400"
              @mousedown.stop
              @keydown.stop
            />
            
            <!-- Size slider | 大小滑块 -->
            <div class="flex items-center gap-1 w-16">
              <div class="w-1.5 h-1.5 rounded-full bg-red-400"></div>
              <input 
                type="range" 
                v-model="brushSize" 
                min="10" 
                max="80" 
                class="w-full h-0.5 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-red"
              />
              <div class="w-2.5 h-2.5 rounded-full bg-red-400"></div>
            </div>
            
            <!-- Reset button | 重置按钮 -->
            <button 
              @click="clearMask"
              class="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title="清除"
            >
              <n-icon :size="12" class="text-gray-400"><RefreshOutline /></n-icon>
            </button>
            
            <!-- Apply button | 应用按钮 -->
            <button 
              @click="applyInpaint"
              class="px-2 py-0.5 bg-red-500 hover:bg-red-600 text-white text-xs rounded transition-colors"
            >
              应用
            </button>
          </div>
        </div>

        <!-- URL Loading state | URL 加载状态 -->
        <div v-else-if="urlLoading"
          class="aspect-square rounded-xl bg-gradient-to-br from-cyan-400 via-blue-300 to-amber-200 flex flex-col items-center justify-center gap-3 relative overflow-hidden">
          <div class="absolute inset-0 bg-gradient-to-br from-cyan-500/20 via-blue-400/20 to-amber-300/20 animate-pulse"></div>
          <div class="relative z-10">
            <img src="../../assets/loading.webp" alt="Loading" class="w-14 h-12" />
          </div>
          <span class="text-sm text-white font-medium relative z-10">加载中...</span>
        </div>

        <!-- Upload placeholder | 上传占位 -->
        <div v-else class="rounded-xl bg-[var(--bg-tertiary)] border-2 border-dashed border-[var(--border-color)] p-3">
          <!-- Upload area | 上传区域 -->
          <div class="aspect-video flex flex-col items-center justify-center gap-2 relative cursor-pointer hover:bg-[var(--bg-secondary)] rounded-lg transition-colors">
            <n-icon :size="32" class="text-[var(--text-secondary)]">
              <ImageOutline />
            </n-icon>
            <span class="text-sm text-[var(--text-secondary)] text-center">拖放图片或点击上传</span>
            <input type="file" accept="image/*" class="absolute inset-0 opacity-0 cursor-pointer"
              @change="handleFileUpload" />
          </div>
          
          <!-- Divider | 分割线 -->
          <div class="flex items-center gap-2 my-3">
            <div class="flex-1 h-px bg-[var(--border-color)]"></div>
            <span class="text-xs text-[var(--text-secondary)]">或</span>
            <div class="flex-1 h-px bg-[var(--border-color)]"></div>
          </div>
          
          <!-- URL input | URL 输入 -->
          <div class="flex gap-2">
            <input 
              v-model="urlInput"
              type="text" 
              placeholder="输入图片地址..."
              class="flex-1 px-2 py-1 text-sm bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg outline-none focus:border-[var(--accent-color)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]"
              @keydown.enter="handleUrlSubmit"
            />
            <button 
              @click="handleUrlSubmit"
              :disabled="!urlInput.trim()"
              class="px-3 py-2 text-xs bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              预览
            </button>
          </div>
        </div>
      </div>

      <div v-if="data.url" class="px-3 pb-3 grid grid-cols-3 gap-1.5">
        <button
          v-for="action in editActions"
          :key="action.key"
          @click="openImageEditor(action.key)"
          class="flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded-lg border border-[var(--border-color)] hover:border-[var(--accent-color)] hover:text-[var(--accent-color)] transition-colors"
          :title="action.title"
        >
          <n-icon :size="13"><component :is="action.icon" /></n-icon>
          {{ action.label }}
        </button>
      </div>

      <!-- Handles | 连接点 -->
      <NodeHandleMenu :nodeId="id" nodeType="image" :visible="showHandleMenu" :operations="operations" @select="handleSelect" />
      <Handle type="target" :position="Position.Left" id="left" class="!bg-[var(--accent-color)]" />
    </div>
  </div>

  <!-- Image preview dialog | 图片预览弹窗 -->
  <n-image-preview
    v-model:show="showRef"
    :src="props.data?.url"
  />

  <!-- Image editor modal | 图片编辑弹窗 -->
  <n-modal
    v-model:show="showImageEditor"
    preset="card"
    title="图片编辑"
    :style="{ width: '860px', maxWidth: 'calc(100vw - 48px)' }"
    :mask-closable="true"
  >
    <div class="flex gap-4">
      <div class="flex-1 min-w-0 space-y-3">
        <div
          ref="editorImageContainerRef"
          class="relative rounded-xl overflow-hidden bg-[var(--bg-tertiary)] border border-[var(--border-color)] min-h-[420px] flex items-center justify-center"
        >
        <img
          ref="editorImageRef"
          :src="props.data?.url"
          :alt="props.data?.label"
          class="max-w-full max-h-[620px] object-contain"
          :class="{
            'pointer-events-none': isEditorInpaintMode,
            'select-none': isEditorCropMode
          }"
          draggable="false"
        />

          <div
            v-if="isEditorCropMode"
            class="absolute inset-0 z-10 cursor-crosshair"
            @mousedown.stop.prevent="onCropPointerDown"
            @mousemove.stop.prevent="onCropPointerMove"
            @mouseup.stop.prevent="onCropPointerUp"
            @mouseleave.stop.prevent="onCropPointerUp"
          >
            <div
              v-if="cropSelection.visible"
              class="absolute border-2 border-white bg-white/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
              :style="cropSelectionStyle"
            />
          </div>

          <canvas
            v-if="isEditorInpaintMode"
            ref="editorCanvasRef"
            class="absolute inset-0 w-full h-full cursor-none z-10"
            @mousedown.stop.prevent="onEditorCanvasPaint"
            @mousemove.stop="onEditorCanvasMove"
            @mouseup.stop="onEditorPaintEnd"
            @mouseleave="onEditorPaintEnd"
          />

          <div
            v-show="editorBrushCursor.visible && isEditorInpaintMode"
            class="absolute pointer-events-none border-2 border-red-500 rounded-full bg-red-400/25 transition-none z-20"
            :style="{
              width: brushSize * 2 + 'px',
              height: brushSize * 2 + 'px',
              left: editorBrushCursor.x - brushSize + 'px',
              top: editorBrushCursor.y - brushSize + 'px'
            }"
          />
        </div>

        <div
          v-if="isEditorInpaintMode"
          class="flex items-center gap-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-700 px-3 py-2 shadow-sm"
          @mousedown.stop
          @click.stop
        >
          <input
            v-if="currentEditMode === 'mark'"
            v-model="editPrompt"
            placeholder="说明要怎么修改..."
            class="flex-1 min-w-0 px-3 py-1.5 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:border-red-400"
            @mousedown.stop
            @keydown.stop
          />
          <div class="flex items-center gap-2">
            <span class="w-1.5 h-1.5 rounded-full bg-red-400"></span>
            <input
              type="range"
              v-model="brushSize"
              min="10"
              max="80"
              class="w-24 h-0.5 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-red"
            />
            <span class="w-3 h-3 rounded-full bg-red-400"></span>
          </div>
          <button @click="clearEditorMask" class="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors" title="清除">
            <n-icon :size="14"><RefreshOutline /></n-icon>
          </button>
          <button @click="applyEditorInpaint" class="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg transition-colors">
            应用
          </button>
        </div>

        <div
          v-if="isEditorCropMode"
          class="flex items-center gap-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-700 px-3 py-2 shadow-sm"
          @mousedown.stop
          @click.stop
        >
          <button
            v-for="option in cropAspectOptions"
            :key="option.value"
            @click="setSelectedCropAspect(option.value)"
            class="px-3 py-1.5 text-sm rounded-lg border transition-colors"
            :class="selectedCropAspect === option.value ? 'border-[var(--accent-color)] text-[var(--accent-color)]' : 'border-[var(--border-color)] hover:border-[var(--accent-color)]'"
          >
            {{ option.label }}
          </button>
          <button @click="applyCrop" class="ml-auto px-3 py-1.5 bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white text-sm rounded-lg transition-colors">
            应用裁剪
          </button>
        </div>
      </div>

      <div class="w-28 shrink-0 grid grid-cols-1 content-start gap-2">
        <button
          v-for="action in editActions"
          :key="action.key"
          @click="handleEditorAction(action.key)"
          class="flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg border border-[var(--border-color)] hover:border-[var(--accent-color)] hover:text-[var(--accent-color)] transition-colors"
          :class="{ 'border-red-400 text-red-500': (isEditorInpaintMode && currentEditMode === action.key) || (isEditorCropMode && action.key === 'crop') }"
          :title="action.title"
        >
          <n-icon :size="15"><component :is="action.icon" /></n-icon>
          {{ action.label }}
        </button>
      </div>
    </div>
  </n-modal>

  <!-- Replace image modal | 替换图片弹窗 -->
  <n-modal v-model:show="showReplaceModal" preset="card" title="替换图片" class="w-[400px]" :mask-closable="true">
    <div class="space-y-4">
      <!-- Upload area | 上传区域 -->
      <div
        class="border-2 border-dashed border-[var(--border-color)] rounded-xl p-4 cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors"
        @click="replaceFileInputRef?.click()"
      >
        <div class="flex flex-col items-center gap-2">
          <n-icon :size="32" class="text-[var(--text-secondary)]">
            <ImageOutline />
          </n-icon>
          <span class="text-sm text-[var(--text-secondary)]">点击上传图片</span>
          <input
            ref="replaceFileInputRef"
            type="file"
            accept="image/*"
            class="hidden"
            @change="handleReplaceFileUpload"
          />
        </div>
      </div>

      <!-- Divider | 分割线 -->
      <div class="flex items-center gap-2">
        <div class="flex-1 h-px bg-[var(--border-color)]"></div>
        <span class="text-xs text-[var(--text-secondary)]">或</span>
        <div class="flex-1 h-px bg-[var(--border-color)]"></div>
      </div>

      <!-- URL input | URL 输入 -->
      <div class="flex gap-2">
        <input
          v-model="replaceUrlInput"
          type="text"
          placeholder="输入图片地址..."
          class="flex-1 px-3 py-2 text-sm bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg outline-none focus:border-[var(--accent-color)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]"
          @keydown.enter="handleReplaceUrlSubmit"
        />
        <n-button type="primary" size="small" :disabled="!replaceUrlInput.trim()" @click="handleReplaceUrlSubmit">
          确认
        </n-button>
      </div>
    </div>
  </n-modal>
</template>

<script setup>
/**
 * Image node component | 图片节点组件
 * Displays and manages image content with loading state
 */
import { ref, nextTick, computed } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { NIcon, NTooltip, NSwitch, NImagePreview, NModal, NButton } from 'naive-ui'
import { TrashOutline, ExpandOutline, ImageOutline, CloseCircleOutline, CopyOutline, VideocamOutline, DownloadOutline, EyeOutline, BrushOutline, RefreshOutline, ColorWandOutline, SwapHorizontalOutline, CropOutline } from '@vicons/ionicons5'
import { updateNode, removeNode, duplicateNode, addNode, addEdge, nodes } from '../../stores/canvas'
import NodeHandleMenu from './NodeHandleMenu.vue'

const props = defineProps({
  id: String,
  data: Object
})

// Vue Flow instance | Vue Flow 实例
const { updateNodeInternals } = useVueFlow()

// Hover state | 悬浮状态
const showActions = ref(true)
const showHandleMenu = ref(false)

// Label editing state | Label 编辑状态
const isEditingLabel = ref(false)
const editingLabelValue = ref('')
const labelInputRef = ref(null)

// URL input state | URL 输入状态
const urlInput = ref('')
const urlLoading = ref(false)

// Replace modal state | 替换弹窗状态
const showReplaceModal = ref(false)
const replaceUrlInput = ref('')
const replaceFileInputRef = ref(null)
const showImageEditor = ref(false)

// Inpainting state | 涂抹重绘状态
const isInpaintMode = ref(false)
const isEditorInpaintMode = ref(false)
const isEditorCropMode = ref(false)
const brushSize = ref(40)
const isDrawing = ref(false)
const canvasRef = ref(null)
const imageContainerRef = ref(null)
const editorCanvasRef = ref(null)
const editorImageRef = ref(null)
const editorImageContainerRef = ref(null)
const interactionLayerRef = ref(null)
const brushCursor = ref({ x: 0, y: 0, visible: false })
const editorBrushCursor = ref({ x: 0, y: 0, visible: false })
const maskData = ref(null)
const currentEditMode = ref('erase')
const editPrompt = ref('')
const cropAspect = ref(props.data?.cropAspect || '')
const selectedCropAspect = ref('1 / 1')
const cropSelection = ref({ visible: false, x: 0, y: 0, width: 0, height: 0 })
const cropDragStart = ref(null)

const cropAspectOptions = [
  { label: '1:1', value: '1 / 1', ratio: 1 },
  { label: '16:9', value: '16 / 9', ratio: 16 / 9 },
  { label: '9:16', value: '9 / 16', ratio: 9 / 16 },
  { label: '4:3', value: '4 / 3', ratio: 4 / 3 },
  { label: '3:4', value: '3 / 4', ratio: 3 / 4 }
]

const editActions = [
  { key: 'outpaint', label: '扩图', icon: ExpandOutline, title: '创建扩图工作流' },
  { key: 'crop', label: '裁剪', icon: CropOutline, title: '切换裁剪比例' },
  { key: 'mark', label: '标记', icon: BrushOutline, title: '红笔标记修改区域' },
  { key: 'erase', label: '擦除', icon: BrushOutline, title: '涂抹要擦除的区域' },
  { key: 'upscale', label: '高清', icon: ColorWandOutline, title: '创建高清放大工作流' },
  { key: 'regenerate', label: '重生成', icon: RefreshOutline, title: '基于当前图片重新生成' }
]

const editModeLabel = computed(() => currentEditMode.value === 'mark' ? '标记' : '擦除')

const imageDisplayStyle = computed(() => {
  if (!cropAspect.value) return {}
  return {
    aspectRatio: cropAspect.value,
    objectFit: 'cover'
  }
})

const cropSelectionStyle = computed(() => {
  if (!cropSelection.value.visible) return {}
  return {
    left: `${cropSelection.value.x}px`,
    top: `${cropSelection.value.y}px`,
    width: `${cropSelection.value.width}px`,
    height: `${cropSelection.value.height}px`
  }
})


// Computed public props status | 计算是否公开
const isPublic = computed(() => {
  return props.data?.publicProps?.name != null && props.data?.publicProps?.name !== ''
})

// Handle toggle public | 处理切换公开状态
const handleTogglePublic = (value) => {
  if (value) {
    // 公开：使用节点名称
    const name = props.data?.label || '图片'
    updateNode(props.id, {
      publicProps: { name }
    })
  } else {
    // 取消公开
    updateNode(props.id, {
      publicProps: {}
    })
  }
}

// Image node menu operations | 图片节点菜单操作
const operations = [
  { type: 'imageConfig', label: '图片编辑', icon: BrushOutline, action: 'image_edit' },
  { type: 'imageConfig', label: '图生图', icon: ImageOutline, action: 'image_imageConfig' },
  { type: 'videoConfig', label: '生视频', icon: VideocamOutline, action: 'image_videoConfig' }
]

// Handle menu select | 处理菜单选择
const handleSelect = (item) => {
  const action = item.action

  if (action === 'image_edit') {
    openImageEditor('mark')
  } else if (action === 'image_imageConfig') {
    // Image-to-image workflow | 图生图工作流
    const currentNode = nodes.value.find(n => n.id === props.id)
    const nodeX = currentNode?.position?.x || 0
    const nodeY = currentNode?.position?.y || 0
    const sourceUrl = currentNode?.data?.url

    if (!sourceUrl) {
      window.$message?.warning('当前图片节点没有图片')
      return
    }

    // Create text node for prompt
    const textNodeId = addNode('text', { x: nodeX + 300, y: nodeY - 100 }, {
      content: '',
      label: '提示词'
    })

    // Create imageConfig node
    const configNodeId = addNode('imageConfig', { x: nodeX + 900, y: nodeY }, {
      model: 'doubao-seedream-4-5-251128',
      size: '2048x2048',
      label: '生图配置'
    })

    // Connect edges
    addEdge({ source: props.id, target: configNodeId, sourceHandle: 'right', targetHandle: 'left' })
    addEdge({ source: textNodeId, target: configNodeId, sourceHandle: 'right', targetHandle: 'left' })

    setTimeout(() => updateNodeInternals([textNodeId, configNodeId]), 50)
    window.$message?.success('已创建图生图工作流')
  } else if (action === 'image_videoConfig') {
    // Video generation workflow | 视频生成工作流
    const currentNode = nodes.value.find(n => n.id === props.id)
    const nodeX = currentNode?.position?.x || 0
    const nodeY = currentNode?.position?.y || 0

    // Create text node for prompt
    const textNodeId = addNode('text', { x: nodeX + 300, y: nodeY - 100 }, {
      content: '',
      label: '提示词'
    })

    // Create videoConfig node
    const configNodeId = addNode('videoConfig', { x: nodeX + 600, y: nodeY }, {
      label: '视频生成'
    })

    // Connect image to videoConfig
    addEdge({
      source: props.id,
      target: configNodeId,
      sourceHandle: 'right',
      targetHandle: 'left',
      type: 'imageRole',
      data: { imageRole: 'first_frame_image' }
    })

    // Connect text to videoConfig
    addEdge({
      source: textNodeId,
      target: configNodeId,
      sourceHandle: 'right',
      targetHandle: 'left'
    })

    setTimeout(() => updateNodeInternals([textNodeId, configNodeId]), 50)
    window.$message?.success('已创建视频生成工作流')
  }
}

// Toggle inpaint mode | 切换涂抹模式
const toggleInpaintMode = () => {
  isInpaintMode.value = !isInpaintMode.value
  if (isInpaintMode.value) {
    nextTick(() => initCanvas())
  } else {
    clearMask()
  }
}

const startMaskEdit = (mode) => {
  if (!props.data?.url) {
    window.$message?.warning('当前图片节点没有图片')
    return
  }
  currentEditMode.value = mode
  if (mode === 'mark' && !editPrompt.value) {
    editPrompt.value = ''
  }
  isInpaintMode.value = true
  nextTick(() => initCanvas())
}

const openImageEditor = (mode = '') => {
  if (!props.data?.url) {
    window.$message?.warning('当前图片节点没有图片')
    return
  }
  showImageEditor.value = true
  if (mode === 'mark' || mode === 'erase') {
    nextTick(() => startEditorMaskEdit(mode))
  } else if (mode === 'crop') {
    nextTick(() => startEditorCropMode())
  }
}

const startEditorMaskEdit = (mode) => {
  currentEditMode.value = mode
  isEditorInpaintMode.value = true
  isEditorCropMode.value = false
  nextTick(() => initCanvas(editorCanvasRef.value))
}

const startEditorCropMode = () => {
  isEditorInpaintMode.value = false
  isEditorCropMode.value = true
  selectedCropAspect.value = cropAspect.value || selectedCropAspect.value || '1 / 1'
  nextTick(() => setCenteredCropSelection())
}

const getContainerPoint = (event) => {
  const container = editorImageContainerRef.value
  if (!container) return { x: 0, y: 0 }
  const rect = container.getBoundingClientRect()
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  }
}

const getDisplayedImageBounds = () => {
  const container = editorImageContainerRef.value
  const image = editorImageRef.value
  if (!container || !image) return null

  const containerRect = container.getBoundingClientRect()
  const imageRect = image.getBoundingClientRect()
  return {
    x: imageRect.left - containerRect.left,
    y: imageRect.top - containerRect.top,
    width: imageRect.width,
    height: imageRect.height
  }
}

const clampPointToImage = (point) => {
  const bounds = getDisplayedImageBounds()
  if (!bounds) return point
  return {
    x: Math.min(Math.max(point.x, bounds.x), bounds.x + bounds.width),
    y: Math.min(Math.max(point.y, bounds.y), bounds.y + bounds.height)
  }
}

const setCropSelectionFromPoints = (start, end) => {
  const x = Math.min(start.x, end.x)
  const y = Math.min(start.y, end.y)
  const width = Math.abs(end.x - start.x)
  const height = Math.abs(end.y - start.y)
  cropSelection.value = { visible: width > 2 && height > 2, x, y, width, height }
}

const onCropPointerDown = (event) => {
  const point = clampPointToImage(getContainerPoint(event))
  cropDragStart.value = point
  cropSelection.value = { visible: true, x: point.x, y: point.y, width: 0, height: 0 }
}

const onCropPointerMove = (event) => {
  if (!cropDragStart.value) return
  const point = clampPointToImage(getContainerPoint(event))
  setCropSelectionFromPoints(cropDragStart.value, point)
}

const onCropPointerUp = () => {
  cropDragStart.value = null
}

const setCenteredCropSelection = () => {
  const bounds = getDisplayedImageBounds()
  const option = cropAspectOptions.find(item => item.value === selectedCropAspect.value) || cropAspectOptions[0]
  if (!bounds) return

  let width = bounds.width
  let height = width / option.ratio
  if (height > bounds.height) {
    height = bounds.height
    width = height * option.ratio
  }

  cropSelection.value = {
    visible: true,
    x: bounds.x + (bounds.width - width) / 2,
    y: bounds.y + (bounds.height - height) / 2,
    width,
    height
  }
}

const setSelectedCropAspect = (value) => {
  selectedCropAspect.value = value
  nextTick(() => setCenteredCropSelection())
}

const handleEditorAction = (key) => {
  if (key === 'mark' || key === 'erase') {
    startEditorMaskEdit(key)
    return
  }

  if (key === 'crop') {
    startEditorCropMode()
    return
  }

  isEditorInpaintMode.value = false
  isEditorCropMode.value = false
  handleEditAction(key)
}

const handleEditAction = (key) => {
  if (key === 'mark' || key === 'erase') {
    startMaskEdit(key)
    return
  }

  if (key === 'crop') {
    openImageEditor('crop')
    return
  }

  const prompts = {
    outpaint: '请对这张图片进行扩图，延展画面边缘，保持主体、光线和风格一致。',
    upscale: '请将这张图片高清化，提升细节、清晰度和质感，不改变主体内容。',
    regenerate: '请参考这张图片重新生成一张更完整、更精致的版本。'
  }
  createImageEditWorkflow(prompts[key] || '', key)
}

// Initialize canvas | 初始化画布
const initCanvas = (targetCanvas = canvasRef.value) => {
  setTimeout(() => {
    const canvas = targetCanvas
    if (!canvas) return
    
    // Set canvas internal size to match its CSS rendered size | 设置画布内部尺寸匹配 CSS 渲染尺寸
    // clientWidth/clientHeight give the CSS box size
    canvas.width = canvas.clientWidth
    canvas.height = canvas.clientHeight
    
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }, 100)
}

// Ensure canvas size matches display | 确保画布尺寸匹配显示
const syncCanvasSize = (targetCanvas = canvasRef.value) => {
  const canvas = targetCanvas
  if (!canvas) return
  if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
    canvas.width = canvas.clientWidth
    canvas.height = canvas.clientHeight
  }
}

// Canvas paint handlers | 画布绘制处理器
const onCanvasPaint = (e) => {
  syncCanvasSize(canvasRef.value)
  isDrawing.value = true
  paintAt(e.offsetX, e.offsetY, canvasRef.value)
  brushCursor.value = { x: e.offsetX, y: e.offsetY, visible: true }
}

const onCanvasMove = (e) => {
  brushCursor.value = { x: e.offsetX, y: e.offsetY, visible: true }
  if (isDrawing.value) {
    paintAt(e.offsetX, e.offsetY, canvasRef.value)
  }
}

const onPaintEnd = () => {
  isDrawing.value = false
  brushCursor.value.visible = false
}

const onEditorCanvasPaint = (event) => {
  syncCanvasSize(editorCanvasRef.value)
  isDrawing.value = true
  paintAt(event.offsetX, event.offsetY, editorCanvasRef.value)
  editorBrushCursor.value = { x: event.offsetX, y: event.offsetY, visible: true }
}

const onEditorCanvasMove = (event) => {
  editorBrushCursor.value = { x: event.offsetX, y: event.offsetY, visible: true }
  if (isDrawing.value) {
    paintAt(event.offsetX, event.offsetY, editorCanvasRef.value)
  }
}

const onEditorPaintEnd = () => {
  isDrawing.value = false
  editorBrushCursor.value.visible = false
}

// Paint at coordinates | 在坐标绘制
const paintAt = (x, y, targetCanvas = canvasRef.value) => {
  const canvas = targetCanvas
  if (!canvas) return
  
  const ctx = canvas.getContext('2d')
  ctx.beginPath()
  ctx.arc(x, y, brushSize.value, 0, Math.PI * 2)
  ctx.fillStyle = currentEditMode.value === 'mark' ? 'rgba(239, 68, 68, 0.55)' : 'rgba(239, 68, 68, 0.35)'
  ctx.fill()
}

// Hide brush cursor | 隐藏画笔光标
const hideBrushCursor = () => {
  brushCursor.value.visible = false
}

// Clear mask | 清除蒙版
const clearMask = () => {
  const canvas = canvasRef.value
  if (!canvas) return
  
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  maskData.value = null
}

const clearEditorMask = () => {
  const canvas = editorCanvasRef.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  maskData.value = null
}

const loadImageForCanvas = (url) => {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = url
  })
}

const applyCrop = async () => {
  if (!props.data?.url) return

  const option = cropAspectOptions.find(item => item.value === selectedCropAspect.value) || cropAspectOptions[0]

  try {
    const image = await loadImageForCanvas(props.data.url)
    const sourceWidth = image.naturalWidth || image.width
    const sourceHeight = image.naturalHeight || image.height

    let cropX = 0
    let cropY = 0
    let cropWidth = sourceWidth
    let cropHeight = sourceHeight

    if (cropSelection.value.visible && cropSelection.value.width > 5 && cropSelection.value.height > 5) {
      const bounds = getDisplayedImageBounds()
      if (!bounds) {
        window.$message?.error('未找到可裁剪区域')
        return
      }

      const selectionX = Math.max(cropSelection.value.x, bounds.x)
      const selectionY = Math.max(cropSelection.value.y, bounds.y)
      const selectionRight = Math.min(cropSelection.value.x + cropSelection.value.width, bounds.x + bounds.width)
      const selectionBottom = Math.min(cropSelection.value.y + cropSelection.value.height, bounds.y + bounds.height)
      const selectionWidth = Math.max(1, selectionRight - selectionX)
      const selectionHeight = Math.max(1, selectionBottom - selectionY)

      cropX = Math.round(((selectionX - bounds.x) / bounds.width) * sourceWidth)
      cropY = Math.round(((selectionY - bounds.y) / bounds.height) * sourceHeight)
      cropWidth = Math.round((selectionWidth / bounds.width) * sourceWidth)
      cropHeight = Math.round((selectionHeight / bounds.height) * sourceHeight)
    } else {
      const sourceRatio = sourceWidth / sourceHeight
      const targetRatio = option.ratio

      if (sourceRatio > targetRatio) {
        cropWidth = Math.round(sourceHeight * targetRatio)
      } else {
        cropHeight = Math.round(sourceWidth / targetRatio)
      }

      cropX = Math.round((sourceWidth - cropWidth) / 2)
      cropY = Math.round((sourceHeight - cropHeight) / 2)
    }

    cropX = Math.max(0, Math.min(cropX, sourceWidth - 1))
    cropY = Math.max(0, Math.min(cropY, sourceHeight - 1))
    cropWidth = Math.max(1, Math.min(cropWidth, sourceWidth - cropX))
    cropHeight = Math.max(1, Math.min(cropHeight, sourceHeight - cropY))

    const outputCanvas = document.createElement('canvas')
    outputCanvas.width = cropWidth
    outputCanvas.height = cropHeight

    const ctx = outputCanvas.getContext('2d')
    ctx.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight)

    const croppedUrl = outputCanvas.toDataURL('image/png')
    cropAspect.value = option.value
    updateNode(props.id, {
      url: croppedUrl,
      base64: croppedUrl,
      cropAspect: option.value,
      label: props.data?.label || '裁剪图片',
      updatedAt: Date.now()
    })
    isEditorCropMode.value = false
    cropSelection.value = { visible: false, x: 0, y: 0, width: 0, height: 0 }
    window.$message?.success('裁剪已应用')
  } catch (err) {
    console.error('Crop failed:', err)
    window.$message?.error('裁剪失败，图片可能不允许跨域处理')
  }
}

// Apply inpaint and create workflow | 应用重绘并创建工作流
const applyInpaint = (targetCanvas = canvasRef.value, targetContainer = imageContainerRef.value) => {
  const canvas = targetCanvas
  if (!canvas || canvas.width === 0 || canvas.height === 0) {
    window.$message?.error('画布未初始化')
    return
  }

  const sourceCtx = canvas.getContext('2d')
  const sourceData = sourceCtx.getImageData(0, 0, canvas.width, canvas.height)
  const hasPaintedArea = sourceData.data.some((value, index) => index % 4 === 3 && value > 0)
  if (!hasPaintedArea) {
    window.$message?.warning('请先涂抹要局部重绘的区域')
    return
  }
  
  // Get the original image and resize mask to match | 获取原图并调整蒙版大小匹配
  const container = targetContainer
  const img = container?.querySelector('img')
  if (!img) {
    window.$message?.error('未找到图片')
    return
  }
  
  // Create mask at original image resolution | 创建原图分辨率的蒙版
  const maskCanvas = document.createElement('canvas')
  const imgWidth = img.naturalWidth || img.width
  const imgHeight = img.naturalHeight || img.height
  maskCanvas.width = imgWidth
  maskCanvas.height = imgHeight
  const maskCtx = maskCanvas.getContext('2d')
  
  // Fill black background | 填充黑色背景
  maskCtx.fillStyle = '#000000'
  maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height)
  
  // Scale factor from display to original | 从显示尺寸到原图的缩放因子
  const scaleX = imgWidth / canvas.width
  const scaleY = imgHeight / canvas.height
  
  // Draw scaled white areas on mask | 在蒙版上绘制缩放后的白色区域
  maskCtx.fillStyle = '#FFFFFF'
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4
      if (sourceData.data[i + 3] > 0) {
        // Scale and draw | 缩放并绘制
        maskCtx.fillRect(
          Math.floor(x * scaleX),
          Math.floor(y * scaleY),
          Math.ceil(scaleX),
          Math.ceil(scaleY)
        )
      }
    }
  }
  
  // Convert to base64 (remove data URL prefix for API) | 转换为 base64（移除前缀用于 API）
  const dataUrl = maskCanvas.toDataURL('image/png')
  const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '')
  maskData.value = base64Data
  
  // Create inpaint workflow | 创建重绘工作流
  createInpaintWorkflow()
}

const applyEditorInpaint = () => {
  applyInpaint(editorCanvasRef.value, editorImageContainerRef.value)
}

// Create inpaint workflow | 创建重绘工作流
const createInpaintWorkflow = () => {
  if (currentEditMode.value === 'mark' && !editPrompt.value.trim()) {
    window.$message?.warning('请先说明标记区域要怎么修改')
    return
  }

  const currentNode = nodes.value.find(n => n.id === props.id)
  const nodeX = currentNode?.position?.x || 0
  const nodeY = currentNode?.position?.y || 0
  
  // Create text node for prompt | 创建文本节点用于提示词
  const prompt = currentEditMode.value === 'mark'
    ? editPrompt.value.trim()
    : '请擦除涂抹区域并自然补全背景，保持画面风格一致。'
  const textNodeId = addNode('text', { x: nodeX + 300, y: nodeY - 100 }, {
    content: prompt,
    label: currentEditMode.value === 'mark' ? '标记修改说明' : '擦除说明'
  })
  
  // Create imageConfig node for inpainting | 创建图生图配置节点
  const configNodeId = addNode('imageConfig', { x: nodeX + 600, y: nodeY }, {
    model: 'doubao-seedream-4-5-251128',
    size: '2048x2048',
    label: currentEditMode.value === 'mark' ? '标记重绘' : '局部擦除',
    inpaintMode: true,
    editMode: currentEditMode.value,
    maskSourceNodeId: props.id
  })
  
  // Update current node with mask data | 更新当前节点的蒙版数据
  updateNode(props.id, {
    maskData: maskData.value,
    hasInpaintMask: true
  })
  
  // Connect image node to config node | 连接图片节点到配置节点
  addEdge({
    source: props.id,
    target: configNodeId,
    sourceHandle: 'right',
    targetHandle: 'left'
  })
  
  // Connect text node to config node | 连接文本节点到配置节点
  addEdge({
    source: textNodeId,
    target: configNodeId,
    sourceHandle: 'right',
    targetHandle: 'left'
  })
  
  // Exit inpaint mode | 退出涂抹模式
  isInpaintMode.value = false
  isEditorInpaintMode.value = false
  showImageEditor.value = false
  
  // Force Vue Flow to recalculate | 强制重新计算
  setTimeout(() => {
    updateNodeInternals([textNodeId, configNodeId])
  }, 50)
  
  window.$message?.success('已创建局部重绘工作流')
}

const createImageEditWorkflow = (prompt, mode) => {
  const currentNode = nodes.value.find(n => n.id === props.id)
  const nodeX = currentNode?.position?.x || 0
  const nodeY = currentNode?.position?.y || 0

  const textNodeId = addNode('text', { x: nodeX + 300, y: nodeY - 120 }, {
    content: prompt,
    label: mode === 'outpaint' ? '扩图说明' : mode === 'upscale' ? '高清说明' : '重生成提示词'
  })

  const configNodeId = addNode('imageConfig', { x: nodeX + 620, y: nodeY }, {
    model: 'doubao-seedream-4-5-251128',
    size: mode === 'outpaint' ? 'auto' : '2048x2048',
    label: mode === 'outpaint' ? '扩图' : mode === 'upscale' ? '高清放大' : '图生图重生成'
  })

  addEdge({
    source: props.id,
    target: configNodeId,
    sourceHandle: 'right',
    targetHandle: 'left'
  })

  addEdge({
    source: textNodeId,
    target: configNodeId,
    sourceHandle: 'right',
    targetHandle: 'left'
  })

  setTimeout(() => updateNodeInternals([textNodeId, configNodeId]), 50)
  window.$message?.success('已创建图片编辑工作流')
}

// Convert file to base64 | 将文件转换为 base64
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Handle file upload | 处理文件上传
const handleFileUpload = async (event) => {
  const file = event.target.files[0]
  if (file) {
    try {
      // Convert to base64 | 转换为 base64
      const base64 = await fileToBase64(file)
      // Store both display URL and base64 | 同时存储显示 URL 和 base64
      updateNode(props.id, {
        url: base64,  // Use base64 as display URL | 使用 base64 作为显示 URL
        base64: base64,  // Store base64 for API calls | 存储 base64 用于 API 调用
        fileName: file.name,
        fileType: file.type,
        label: '参考图',
        updatedAt: Date.now()
      })
    } catch (err) {
      console.error('File upload error:', err)
      window.$message?.error('图片上传失败')
    }
  }
}

// Handle URL submit | 处理 URL 提交
const handleUrlSubmit = () => {
  const url = urlInput.value.trim()
  if (!url) return
  
  // Validate URL format | 验证 URL 格式
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    window.$message?.warning('请输入有效的图片地址 (http:// 或 https://)')
    return
  }
  
  // Show loading state | 显示加载状态
  urlLoading.value = true
  
  // Preload image to check validity | 预加载图片检查有效性
  const img = new Image()
  img.onload = () => {
    // Update node with URL | 更新节点 URL
    updateNode(props.id, {
      url: url,
      label: '网络图片',
      updatedAt: Date.now()
    })
    urlInput.value = ''
    urlLoading.value = false
  }
  img.onerror = () => {
    window.$message?.error('图片加载失败，请检查地址是否正确')
    urlLoading.value = false
  }
  img.src = url
}



// Handle replace file upload | 处理替换文件上传
const handleReplaceFileUpload = async (event) => {
  const file = event.target.files[0]
  if (file) {
    try {
      const base64 = await fileToBase64(file)
      updateNode(props.id, {
        url: base64,
        base64: base64,
        fileName: file.name,
        fileType: file.type,
        label: '参考图',
        updatedAt: Date.now()
      })
      showReplaceModal.value = false
      replaceUrlInput.value = ''
      window.$message?.success('图片已替换')
    } catch (err) {
      console.error('File upload error:', err)
      window.$message?.error('图片上传失败')
    }
  }
}

// Handle replace URL submit | 处理替换 URL 提交
const handleReplaceUrlSubmit = () => {
  const url = replaceUrlInput.value.trim()
  if (!url) return

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    window.$message?.warning('请输入有效的图片地址 (http:// 或 https://)')
    return
  }

  const img = new Image()
  img.onload = () => {
    updateNode(props.id, {
      url: url,
      label: '网络图片',
      updatedAt: Date.now()
    })
    showReplaceModal.value = false
    replaceUrlInput.value = ''
    window.$message?.success('图片已替换')
  }
  img.onerror = () => {
    window.$message?.error('图片加载失败，请检查地址是否正确')
  }
  img.src = url
}

// Start editing label | 开始编辑 label
const startEditLabel = () => {
  editingLabelValue.value = props.data?.label || '图像生成结果'
  isEditingLabel.value = true
  nextTick(() => {
    labelInputRef.value?.focus()
    labelInputRef.value?.select()
  })
}

// Finish editing label | 完成编辑 label
const finishEditLabel = () => {
  const newLabel = editingLabelValue.value.trim()
  if (newLabel && newLabel !== props.data?.label) {
    updateNode(props.id, { label: newLabel })
  }
  isEditingLabel.value = false
}

// Cancel editing label | 取消编辑 label
const cancelEditLabel = () => {
  isEditingLabel.value = false
}

// Handle delete | 处理删除
const handleDelete = () => {
  removeNode(props.id)
}

// Handle duplicate | 处理复制
const handleDuplicate = () => {
  const newId = duplicateNode(props.id)
  if (newId) {
    // Clear selection and select the new node | 清除选中并选中新节点
    updateNode(props.id, { selected: false })
    updateNode(newId, { selected: true })
    window.$message?.success('节点已复制')
    setTimeout(() => {
      updateNodeInternals(newId)
    }, 50)
  }
}

// Handle image generation | 处理图片生图（图生图）
const handleImageGen = () => {
  const currentNode = nodes.value.find(n => n.id === props.id)
  const nodeX = currentNode?.position?.x || 0
  const nodeY = currentNode?.position?.y || 0

  // Create text node for prompt | 创建文本节点用于提示词
  const textNodeId = addNode('text', { x: nodeX + 300, y: nodeY - 100 }, {
    content: '',
    label: '提示词'
  })

  // Create ImageNode for editing | 创建图片编辑节点
  const imageNodeId = addNode('image', { x: nodeX + 600, y: nodeY }, {
    url: props.data.url,  // Pass the current image as input
    label: '图生图',
    refImage: props.data.url  // Mark as reference image
  })

  // Create imageConfig node for generation | 创建生图配置节点
  const configNodeId = addNode('imageConfig', { x: nodeX + 900, y: nodeY }, {
    model: 'doubao-seedream-4-5-251128',
    size: '2048x2048',
    label: '生图配置'
  })

  // Connect image node to new image node | 连接当前图片节点到新图片节点
  addEdge({
    source: props.id,
    target: imageNodeId,
    sourceHandle: 'right',
    targetHandle: 'left'
  })

  // Connect new image node to config node | 连接新图片节点到配置节点
  addEdge({
    source: imageNodeId,
    target: configNodeId,
    sourceHandle: 'right',
    targetHandle: 'left'
  })

  // Connect text node to config node | 连接文本节点到配置节点
  addEdge({
    source: textNodeId,
    target: configNodeId,
    sourceHandle: 'right',
    targetHandle: 'left'
  })

  // Force Vue Flow to recalculate node dimensions | 强制 Vue Flow 重新计算节点尺寸
  setTimeout(() => {
    updateNodeInternals([textNodeId, imageNodeId, configNodeId])
  }, 50)

  window.$message?.success('已创建图生图工作流')
}

// Preview state | 预览状态
const showRef = ref(false)

// Handle preview | 处理预览
const handlePreview = () => {
  if (props.data.url) {
    showRef.value = true
  }
}

// Handle download | 处理下载
const handleDownload = () => {
  if (props.data.url) {
    const link = document.createElement('a')
    link.href = props.data.url
    link.download = props.data.fileName || `image_${Date.now()}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.$message?.success('图片下载中...')
  }
}

// Handle video generation | 处理视频生成
const handleVideoGen = () => {
  const currentNode = nodes.value.find(n => n.id === props.id)
  const nodeX = currentNode?.position?.x || 0
  const nodeY = currentNode?.position?.y || 0

  // Create text node for prompt | 创建文本节点用于提示词
  const textNodeId = addNode('text', { x: nodeX + 300, y: nodeY - 100 }, {
    content: '',
    label: '提示词'
  })

  // Create videoConfig node | 创建视频配置节点
  const configNodeId = addNode('videoConfig', { x: nodeX + 600, y: nodeY }, {
    label: '视频生成'
  })

  // Connect image node to config node with role | 连接图片节点到配置节点并设置角色
  addEdge({
    source: props.id,
    target: configNodeId,
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'imageRole',
    data: { imageRole: 'first_frame_image' } // Default to first frame | 默认首帧
  })

  // Connect text node to config node | 连接文本节点到配置节点
  addEdge({
    source: textNodeId,
    target: configNodeId,
    sourceHandle: 'right',
    targetHandle: 'left'
  })

  // Force Vue Flow to recalculate node dimensions | 强制 Vue Flow 重新计算节点尺寸
  setTimeout(() => {
    updateNodeInternals([textNodeId, configNodeId])
  }, 50)
}
</script>

<style scoped>
.image-node-wrapper {
  position: relative;
  padding-right: 50px;
  padding-top: 20px;
}

.image-node {
  cursor: default;
  position: relative;
}

/* Slider styling | 滑块样式 */
.slider-red::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #ef4444;
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.slider-red::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #ef4444;
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

/* Inpaint mode cursor | 涂抹模式光标 */
.cursor-none {
  cursor: none;
}
</style>
