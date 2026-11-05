// Smoke test for examples/minimal-host (ADR-0012 §4): starts the built host
// against MINIMAL_HOST_DATABASE_URL and checks that Publisher answers.
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const entry = fileURLToPath(new URL('../examples/minimal-host/.output/server/index.mjs', import.meta.url))
const port = '3123'
const base = `http://127.0.0.1:${port}`
if (!process.env.MINIMAL_HOST_DATABASE_URL) throw new Error('MINIMAL_HOST_DATABASE_URL is required')

const server = spawn(process.execPath, [entry], { env: { ...process.env, PORT: port, HOST: '127.0.0.1' }, stdio: 'inherit' })
const fail = (message) => { server.kill(); console.error(`Smoke test failed: ${message}`); process.exit(1) }

async function get(path) {
  const response = await fetch(`${base}${path}`)
  return { status: response.status, body: await response.json().catch(() => null) }
}

let ready = false
for (let attempt = 0; attempt < 60 && !ready; attempt++) {
  await new Promise(resolve => setTimeout(resolve, 500))
  ready = await get('/api/publisher/resolve?path=%2Fnothing-here').then(answer => answer.status === 200, () => false)
}
if (!ready) fail('the host did not answer within 30 seconds')

const nothing = await get('/api/publisher/resolve?path=%2Fnothing-here')
if (nothing.body?.kind !== 'none') fail(`resolve answered ${JSON.stringify(nothing.body)}, not { kind: 'none' }`)
const admin = await get('/api/publisher/admin/types')
if (admin.status !== 401) fail(`administration answered ${admin.status} with nobody signed in, not 401`)

server.kill()
console.log('Smoke test passed: examples/minimal-host composes Publisher and answers')
