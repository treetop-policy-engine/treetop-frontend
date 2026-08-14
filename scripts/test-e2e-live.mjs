import { spawn } from 'node:child_process'
import path from 'node:path'
import { ensureTreetopServer, run, uploadFixture, waitForHttp } from './lib/treetop-release.mjs'

const release = process.env.TREETOP_REST_VERSION ?? 'v0.0.12'
const port = Number(process.env.TREETOP_E2E_PORT ?? 19998)
const root = process.cwd()
const binary = await ensureTreetopServer({ root, release })
const accessToken = 'frontend-live-access-token'

let tokenResolve
let tokenReject
const tokenPromise = new Promise((resolve, reject) => {
  tokenResolve = resolve
  tokenReject = reject
})
const tokenTimeout = setTimeout(() => tokenReject(new Error('Timed out waiting for the upload token')), 10_000)

const server = spawn(binary, [
  '--port', String(port),
  '--allow-upload',
  '--workers', '1',
  '--rayon-threads', '1',
], {
  env: { ...process.env, TREETOP_ACCESS_TOKENS: accessToken, RUST_LOG: 'info' },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let serverLog = ''
for (const stream of [server.stdout, server.stderr]) {
  stream.on('data', (chunk) => {
    const text = chunk.toString()
    serverLog += text
    process.stderr.write(`[treetop] ${text.replace(/("token":")[^"]+/, '$1<redacted>')}`)
    const match = serverLog.match(/"Uploads enabled","token":"([^"]+)"/)
    if (match) tokenResolve(match[1])
  })
}
server.once('exit', (code) => tokenReject(new Error(`Treetop exited before setup completed (${code})`)))

try {
  const token = await tokenPromise
  clearTimeout(tokenTimeout)
  const baseUrl = `http://127.0.0.1:${port}`
  await waitForHttp(`${baseUrl}/livez`)
  await uploadFixture({ baseUrl, pathname: 'schema', file: path.join(root, 'tests/fixtures/app.schema.json'), token, accessToken })
  await uploadFixture({ baseUrl, pathname: 'policies', file: path.join(root, 'tests/fixtures/app.cedar'), token, accessToken })
  await run(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['exec', 'playwright', 'test', '--', '--config', 'playwright.live.config.ts'],
    {
      cwd: root,
      env: {
        ...process.env,
        PLAYWRIGHT_BROWSERS_PATH: '0',
        VITE_TREETOP_PROXY_TARGET: `http://127.0.0.1:${port}`,
        TREETOP_PROXY_ACCESS_TOKEN: accessToken,
      },
    },
  )
} finally {
  clearTimeout(tokenTimeout)
  server.kill('SIGTERM')
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 2_000)
    server.once('exit', () => {
      clearTimeout(timeout)
      resolve()
    })
  })
}
