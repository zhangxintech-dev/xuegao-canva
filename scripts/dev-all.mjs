import { spawn } from 'node:child_process'

const usePostgres = process.argv.includes('--pg')
const databaseUrl = process.env.DATABASE_URL || ''

if (usePostgres && !databaseUrl) {
  console.error('Missing DATABASE_URL. Example:')
  console.error('DATABASE_URL="postgresql://zian@127.0.0.1:5432/xuegao_canvas" npm run dev:all:pg')
  process.exit(1)
}

const children = new Set()

const run = (command, args, options = {}) => {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: false,
    ...options
  })
  children.add(child)
  child.on('exit', () => children.delete(child))
  return child
}

const cleanup = () => {
  for (const child of children) {
    child.kill('SIGTERM')
  }
}

process.on('SIGINT', () => {
  cleanup()
  process.exit(130)
})

process.on('SIGTERM', () => {
  cleanup()
  process.exit(143)
})

const backendEnv = {
  ...process.env,
  DB_MODE: usePostgres ? 'postgres' : 'json'
}

const backend = run('node', ['server/src/index.js'], { env: backendEnv })

backend.on('exit', (code) => {
  if (!frontendStarted) {
    console.error(`Backend exited before frontend started. Exit code: ${code}`)
    process.exit(code || 1)
  }
})

let frontendStarted = false

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const waitForBackend = async () => {
  const healthUrl = 'http://127.0.0.1:8787/api/health'
  let lastError = null

  for (let attempt = 1; attempt <= 30; attempt += 1) {
    if (backend.exitCode !== null) {
      throw new Error(`Backend exited with code ${backend.exitCode}`)
    }

    try {
      const response = await fetch(healthUrl)
      if (response.ok) {
        const payload = await response.json()
        console.log(`Backend ready: ${payload?.data?.dbMode || 'unknown'} storage`)
        return
      }
    } catch (error) {
      lastError = error
    }

    await sleep(500)
  }

  throw new Error(`Backend did not become ready on ${healthUrl}. ${lastError?.message || ''}`)
}

try {
  await waitForBackend()
  frontendStarted = true
  const frontend = run('npm', ['run', 'dev'])
  frontend.on('exit', (code) => {
    cleanup()
    process.exit(code || 0)
  })
} catch (error) {
  console.error(error.message)
  cleanup()
  process.exit(1)
}
