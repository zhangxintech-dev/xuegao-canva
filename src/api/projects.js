import { request } from '@/utils'

const PROJECTS_BASE = '/api/projects'

export const listProjects = () => {
  return request({
    url: PROJECTS_BASE,
    method: 'get'
  })
}

export const createProject = (data) => {
  return request({
    url: PROJECTS_BASE,
    method: 'post',
    data
  })
}

export const getProject = (projectId) => {
  return request({
    url: `${PROJECTS_BASE}/${projectId}`,
    method: 'get'
  })
}

export const updateProject = (projectId, data) => {
  return request({
    url: `${PROJECTS_BASE}/${projectId}`,
    method: 'patch',
    data
  })
}

export const deleteProject = (projectId) => {
  return request({
    url: `${PROJECTS_BASE}/${projectId}`,
    method: 'delete'
  })
}

export const getProjectCanvas = (projectId) => {
  return request({
    url: `${PROJECTS_BASE}/${projectId}/canvas`,
    method: 'get'
  })
}

export const saveProjectCanvas = (projectId, canvasData) => {
  return request({
    url: `${PROJECTS_BASE}/${projectId}/canvas`,
    method: 'put',
    data: canvasData
  })
}
