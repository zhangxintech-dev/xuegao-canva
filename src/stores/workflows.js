/**
 * Custom workflows store | 自定义工作流存储
 * Persists user-saved workflow snapshots in localStorage.
 */
import { ref } from 'vue'
import * as workflowsApi from '../api/workflows'

const STORAGE_KEY = 'ai-canvas-custom-workflows'
const PUBLIC_STORAGE_KEY = 'ai-canvas-public-workflows'
const DELETED_PUBLIC_STORAGE_KEY = 'ai-canvas-deleted-public-workflows'

const generateId = () => `workflow_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

export const myWorkflows = ref([])
export const publishedWorkflows = ref([])
export const deletedPublicWorkflowIds = ref([])

const clone = (value) => JSON.parse(JSON.stringify(value))

const hasAppAuthToken = () => {
  try {
    return !!localStorage.getItem('app-auth-token')
  } catch {
    return false
  }
}

const normalizeWorkflow = (workflow) => {
  const data = workflow?.data || workflow || {}
  return {
    id: data.id,
    ownerId: data.ownerId || data.owner_id || '',
    name: data.name || '未命名工作流',
    nodes: data.nodes || data.workflowData?.nodes || data.workflow_data?.nodes || [],
    edges: data.edges || data.workflowData?.edges || data.workflow_data?.edges || [],
    viewport: data.viewport || data.workflowData?.viewport || data.workflow_data?.viewport || {},
    thumbnail: data.thumbnail || '',
    visibility: data.visibility || 'personal',
    isCustomPublic: data.visibility === 'public' || !!data.isCustomPublic,
    createdAt: data.createdAt || data.created_at || new Date().toISOString(),
    updatedAt: data.updatedAt || data.updated_at || new Date().toISOString()
  }
}

const normalizeWorkflowList = (response) => {
  const data = response?.data || response || {}
  const list = Array.isArray(data) ? data : data.workflows || []
  return list.map(normalizeWorkflow).filter(workflow => workflow.id)
}

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

export const loadCloudWorkflows = async () => {
  if (!hasAppAuthToken()) return false
  try {
    const response = await workflowsApi.listWorkflows()
    const workflows = normalizeWorkflowList(response)
    myWorkflows.value = workflows.filter(workflow => workflow.visibility !== 'public')
    publishedWorkflows.value = workflows.filter(workflow => workflow.visibility === 'public')
    saveMyWorkflows()
    savePublishedWorkflows()
    return true
  } catch (error) {
    console.warn('Cloud workflows unavailable, using local workflows:', error.message)
    return false
  }
}

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
  if (hasAppAuthToken()) {
    return workflowsApi.createWorkflow({
      name: workflow.name,
      nodes: workflow.nodes,
      edges: workflow.edges,
      viewport: workflow.viewport,
      thumbnail: workflow.thumbnail,
      visibility: 'personal'
    }).then(response => {
      const remoteWorkflow = normalizeWorkflow(response)
      myWorkflows.value = [remoteWorkflow, ...myWorkflows.value.filter(item => item.id !== workflow.id)]
      saveMyWorkflows()
      return remoteWorkflow
    }).catch(error => {
      console.warn('Failed to save cloud workflow:', error.message)
      return workflow
    })
  }
  return workflow
}

export const deleteMyWorkflow = (id) => {
  myWorkflows.value = myWorkflows.value.filter(workflow => workflow.id !== id)
  saveMyWorkflows()
  if (hasAppAuthToken()) {
    workflowsApi.deleteWorkflow(id).catch(error => {
      console.warn('Failed to delete cloud workflow:', error.message)
    })
  }
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
  if (hasAppAuthToken()) {
    return workflowsApi.updateWorkflow(workflow.id, { visibility: 'public' }).then(response => {
      const remoteWorkflow = normalizeWorkflow(response)
      myWorkflows.value = myWorkflows.value.filter(item => item.id !== workflow.id)
      publishedWorkflows.value = [
        remoteWorkflow,
        ...publishedWorkflows.value.filter(item => item.id !== remoteWorkflow.id && item.sourceId !== workflow.id)
      ]
      saveMyWorkflows()
      savePublishedWorkflows()
      return remoteWorkflow
    }).catch(error => {
      console.warn('Failed to publish cloud workflow:', error.message)
      return publicWorkflow
    })
  }
  return publicWorkflow
}

export const deletePublicWorkflow = (workflow) => {
  if (workflow.isCustomPublic) {
    publishedWorkflows.value = publishedWorkflows.value.filter(item => item.id !== workflow.id)
    if (hasAppAuthToken() && workflow.ownerId) {
      workflowsApi.deleteWorkflow(workflow.id).catch(error => {
        console.warn('Failed to delete cloud public workflow:', error.message)
      })
    }
  } else if (!deletedPublicWorkflowIds.value.includes(workflow.id)) {
    deletedPublicWorkflowIds.value = [...deletedPublicWorkflowIds.value, workflow.id]
  }
  savePublishedWorkflows()
}
