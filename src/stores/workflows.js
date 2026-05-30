/**
 * Custom workflows store | 自定义工作流存储
 * Persists user-saved workflow snapshots in localStorage.
 */
import { ref } from 'vue'

const STORAGE_KEY = 'ai-canvas-custom-workflows'
const PUBLIC_STORAGE_KEY = 'ai-canvas-public-workflows'
const DELETED_PUBLIC_STORAGE_KEY = 'ai-canvas-deleted-public-workflows'

const generateId = () => `workflow_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

export const myWorkflows = ref([])
export const publishedWorkflows = ref([])
export const deletedPublicWorkflowIds = ref([])

const clone = (value) => JSON.parse(JSON.stringify(value))

const cleanNodeForStorage = (node) => {
  if (!node.data) return node

  const data = { ...node.data }
  if (data.base64) delete data.base64
  if (data.maskData) delete data.maskData
  if (data.url?.startsWith?.('data:')) delete data.url

  return { ...node, data }
}

const cleanWorkflowForStorage = (workflow) => ({
  ...workflow,
  nodes: workflow.nodes?.map(cleanNodeForStorage) || [],
  thumbnail: workflow.thumbnail || ''
})

export const loadMyWorkflows = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    myWorkflows.value = stored ? JSON.parse(stored) : []
    const publicStored = localStorage.getItem(PUBLIC_STORAGE_KEY)
    publishedWorkflows.value = publicStored ? JSON.parse(publicStored) : []
    const deletedStored = localStorage.getItem(DELETED_PUBLIC_STORAGE_KEY)
    deletedPublicWorkflowIds.value = deletedStored ? JSON.parse(deletedStored) : []
  } catch (err) {
    console.error('Failed to load workflows:', err)
    myWorkflows.value = []
    publishedWorkflows.value = []
    deletedPublicWorkflowIds.value = []
  }
}

export const loadPublicWorkflows = () => {}

export const saveMyWorkflows = () => {
  const cleaned = myWorkflows.value.map(cleanWorkflowForStorage)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned))
  } catch (err) {
    console.error('Failed to save custom workflows:', err)
    window.$message?.error('工作流保存失败，请清理浏览器存储空间')
  }
}

export const savePublishedWorkflows = () => {
  const cleaned = publishedWorkflows.value.map(cleanWorkflowForStorage)
  try {
    localStorage.setItem(PUBLIC_STORAGE_KEY, JSON.stringify(cleaned))
    localStorage.setItem(DELETED_PUBLIC_STORAGE_KEY, JSON.stringify(deletedPublicWorkflowIds.value))
  } catch (err) {
    console.error('Failed to save public workflows:', err)
    window.$message?.error('公共工作流保存失败，请清理浏览器存储空间')
  }
}

const findThumbnail = (nodes = []) => {
  const mediaNode = [...nodes]
    .filter(node => {
      if (node.type !== 'image' && node.type !== 'video') return false
      const url = node.data?.thumbnail || node.data?.url || ''
      return !!url
    })
    .sort((a, b) => (b.data?.updatedAt || 0) - (a.data?.updatedAt || 0))[0]
  return mediaNode?.data?.thumbnail || mediaNode?.data?.url || ''
}

export const createMyWorkflow = ({ name, nodes = [], edges = [], viewport = {} }) => {
  const now = new Date().toISOString()
  const workflow = {
    id: generateId(),
    name: name || '未命名工作流',
    nodes: clone(nodes),
    edges: clone(edges),
    viewport: clone(viewport),
    thumbnail: findThumbnail(nodes),
    createdAt: now,
    updatedAt: now
  }

  myWorkflows.value = [workflow, ...myWorkflows.value]
  saveMyWorkflows()
  return workflow
}

export const deleteMyWorkflow = (id) => {
  myWorkflows.value = myWorkflows.value.filter(workflow => workflow.id !== id)
  saveMyWorkflows()
}

export const publishWorkflow = (workflow) => {
  const now = new Date().toISOString()
  const publicWorkflow = {
    ...clone(workflow),
    id: `public_${workflow.id}`,
    sourceId: workflow.id,
    isCustomPublic: true,
    publishedAt: now,
    updatedAt: now
  }

  publishedWorkflows.value = [
    publicWorkflow,
    ...publishedWorkflows.value.filter(item => item.sourceId !== workflow.id)
  ]
  deletedPublicWorkflowIds.value = deletedPublicWorkflowIds.value.filter(id => id !== publicWorkflow.id)
  savePublishedWorkflows()
  return publicWorkflow
}

export const deletePublicWorkflow = (workflow) => {
  if (workflow.isCustomPublic) {
    publishedWorkflows.value = publishedWorkflows.value.filter(item => item.id !== workflow.id)
  } else if (!deletedPublicWorkflowIds.value.includes(workflow.id)) {
    deletedPublicWorkflowIds.value = [...deletedPublicWorkflowIds.value, workflow.id]
  }
  savePublishedWorkflows()
}
