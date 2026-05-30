const apiBaseUrl = process.env.API_BASE_URL || 'http://127.0.0.1:8787'
const email = process.env.ADMIN_EMAIL || 'zian@bencom.cn'
const password = process.env.ADMIN_PASSWORD || '123456'

const request = async (path, options = {}) => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Connection: 'close',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {})
    },
    body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload.code >= 400) {
    throw new Error(`${options.method || 'GET'} ${path} failed: ${response.status} ${payload.message || response.statusText}`)
  }
  return payload.data || payload
}

const check = async (label, fn) => {
  try {
    const result = await fn()
    console.log(`✓ ${label}`)
    return result
  } catch (error) {
    console.error(`✗ ${label}`)
    console.error(`  ${error.message}`)
    if (error.cause?.message) {
      console.error(`  cause: ${error.cause.message}`)
    }
    process.exitCode = 1
    return null
  }
}

const health = await check('API health', () => request('/api/health'))
if (!health) process.exit(process.exitCode || 1)

const session = await check(`admin login (${email})`, () => request('/api/auth/login', {
  method: 'POST',
  body: { email, password }
}))
if (!session?.token) process.exit(process.exitCode || 1)

const token = session.token

const adminSummary = await check('admin summary', () => request('/api/admin/summary', { token }))
if (!adminSummary) process.exit(process.exitCode || 1)
const usersPayload = await check('admin users', () => request('/api/admin/users', { token }))
if (!usersPayload) process.exit(process.exitCode || 1)
const projectsPayload = await check('admin projects', () => request('/api/admin/projects', { token }))
if (!projectsPayload) process.exit(process.exitCode || 1)
const logsPayload = await check('admin logs', () => request('/api/admin/logs', { token }))
if (!logsPayload) process.exit(process.exitCode || 1)
const modelsPayload = await check('admin models list', () => request('/api/admin/models', { token }))
if (!modelsPayload) process.exit(process.exitCode || 1)

const smokeEmail = `admin-smoke-${Date.now()}@example.com`
const createdUser = await check('admin user create', () => request('/api/admin/users', {
  method: 'POST',
  token,
  body: {
    name: 'Admin Smoke User',
    email: smokeEmail,
    password: '123456',
    quotaTotal: 12
  }
}))
if (!createdUser) process.exit(process.exitCode || 1)
if (createdUser.email !== smokeEmail) {
  console.error('✗ admin user create')
  console.error('  created user email mismatch')
  process.exitCode = 1
  process.exit(process.exitCode)
}

const createdModel = await check('admin model create', async () => {
  const model = await request('/api/admin/models', {
    method: 'POST',
    token,
    body: {
      type: 'image',
      provider: 'openai',
      displayName: 'Admin Smoke GPT Image',
      modelKey: `gpt-image-1-smoke-${Date.now()}`,
      baseUrl: 'https://api.openai.com',
      endpoint: '/v1/images/generations',
      apiKey: 'sk-test-placeholder'
    }
  })
  if (!model.id) throw new Error('create model response missing id')
  return model
})
if (!createdModel) process.exit(process.exitCode || 1)

if (createdModel?.id) {
  const listedAfterCreate = await check('admin model persisted in database', async () => {
    const payload = await request('/api/admin/models', { token })
    const match = payload.models?.find(model => model.id === createdModel.id)
    if (!match) throw new Error('created model was not found from GET /api/admin/models')
    if (!match.hasApiKey) throw new Error('created model apiKey was not persisted')
    return match
  })
  if (!listedAfterCreate) process.exitCode = 1

  await check('admin model toggle', () => request(`/api/admin/models/${createdModel.id}`, {
    method: 'PATCH',
    token,
    body: { enabled: false }
  }))
  await check('admin model delete', () => request(`/api/admin/models/${createdModel.id}`, {
    method: 'DELETE',
    token
  }))
}

const firstUser = usersPayload?.users?.[0]
if (firstUser?.id) {
  await check('admin quota update', () => request(`/api/admin/users/${firstUser.id}/quota`, {
    method: 'PATCH',
    token,
    body: { quotaTotal: firstUser.quotaTotal ?? 100 }
  }))
}

if (!process.exitCode) {
  console.log('\n后台管理接口自检通过。')
}
