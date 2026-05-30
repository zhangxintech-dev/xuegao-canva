import { request } from '@/utils'

const WORKFLOWS_BASE = '/api/workflows'

export const listWorkflows = () => request({
  url: WORKFLOWS_BASE,
  method: 'get'
})

export const createWorkflow = (data) => request({
  url: WORKFLOWS_BASE,
  method: 'post',
  data
})

export const updateWorkflow = (workflowId, data) => request({
  url: `${WORKFLOWS_BASE}/${workflowId}`,
  method: 'patch',
  data
})

export const deleteWorkflow = (workflowId) => request({
  url: `${WORKFLOWS_BASE}/${workflowId}`,
  method: 'delete'
})
