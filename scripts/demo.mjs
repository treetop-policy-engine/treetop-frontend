import { createServer } from 'node:http'
import fs from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { ensureTreetopServer, uploadFixture, waitForHttp } from './lib/treetop-release.mjs'

const root = process.cwd()
const environmentsRoot = path.join(root, 'demo', 'environments')
const release = process.env.TREETOP_REST_VERSION ?? 'v0.0.12'
const serverPort = Number(process.env.TREETOP_DEMO_SERVER_PORT ?? 9999)
const frontendPort = Number(process.env.TREETOP_DEMO_FRONTEND_PORT ?? 5173)
const fixturesPort = Number(process.env.TREETOP_DEMO_FIXTURES_PORT ?? 18080)
const accessToken = 'frontend-demo-access-token'

async function environmentNames() {
  const entries = await fs.readdir(environmentsRoot, { withFileTypes: true })
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
}

async function readEnvironment(name) {
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`Invalid demo environment: ${name}`)
  const directory = path.join(environmentsRoot, name)
  const manifest = JSON.parse(await fs.readFile(path.join(directory, 'demo.json'), 'utf8'))
  return { directory, manifest }
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject)
      resolve()
    })
  })
}

function close(server) {
  return new Promise((resolve) => server.close(resolve))
}

async function startFixtureServer(directory) {
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
      if (pathname !== '/labels.json') {
        response.writeHead(404).end('Not found')
        return
      }
      const content = await fs.readFile(path.join(directory, 'labels.json'))
      response.writeHead(200, { 'Content-Type': 'application/json' }).end(content)
    } catch {
      response.writeHead(500).end('Unable to read fixture')
    }
  })
  await listen(server, fixturesPort)
  return server
}

function printExamples(manifest, environmentName) {
  if (!Array.isArray(manifest.examples) || !manifest.examples.length) return
  console.log('\nTry these guided requests:')
  for (const example of manifest.examples) {
    console.log(`  ${example.outcome.padEnd(5)}  ${example.summary}`)
    console.log(`         principal ${example.principal}${example.groups?.length ? ` [${example.groups.join(', ')}]` : ''}`)
    console.log(`         action    ${example.action}`)
    console.log(`         resource  ${example.resource}::${example.resourceId}`)
    if (example.attributes && Object.keys(example.attributes).length) {
      console.log(`         attrs     ${JSON.stringify(example.attributes)}`)
    }
    if (example.context && Object.keys(example.context).length) {
      console.log(`         context   ${JSON.stringify(example.context)}`)
    }
    if (example.requestFile) {
      console.log(`         raw JSON  demo/environments/${environmentName}/${example.requestFile}`)
    }
  }
}

const requested = process.argv.slice(2).find((argument) => !argument.startsWith('-')) ?? 'documents'
const names = await environmentNames()
if (process.argv.includes('--list')) {
  console.log('Available demo environments:')
  for (const name of names) {
    const { manifest } = await readEnvironment(name)
    console.log(`  ${name.padEnd(16)} ${manifest.description}`)
  }
  process.exit(0)
}
if (!names.includes(requested)) {
  throw new Error(`Unknown demo “${requested}”. Choose one of: ${names.join(', ')}`)
}

const { directory, manifest } = await readEnvironment(requested)
const binary = await ensureTreetopServer({ root, release })
const fixtureServer = await startFixtureServer(directory)
const children = new Set()
let stopping = false
let finish
let fail
const lifetime = new Promise((resolve, reject) => {
  finish = resolve
  fail = reject
})

function watch(child, name) {
  children.add(child)
  child.once('error', fail)
  child.once('exit', (code, signal) => {
    children.delete(child)
    if (!stopping) fail(new Error(`${name} exited unexpectedly (${code ?? signal})`))
  })
  return child
}

async function shutdown() {
  if (stopping) return
  stopping = true
  for (const child of children) child.kill('SIGTERM')
  await close(fixtureServer)
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    void shutdown().then(finish)
  })
}

const tokenPromise = new Promise((resolve, reject) => {
  const server = watch(spawn(binary, [
    '--port', String(serverPort),
    '--allow-upload',
    '--schema-validation-mode', manifest.schema === false ? 'permissive' : 'strict',
    '--labels-url', `http://127.0.0.1:${fixturesPort}/labels.json`,
    '--labels-refresh', '2',
    '--workers', '1',
    '--rayon-threads', '1',
  ], {
    env: {
      ...process.env,
      TREETOP_ACCESS_TOKENS: accessToken,
      RUST_LOG: 'treetop_server=info,treetop_rest=warn,actix_server=warn',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  }), 'treetop-server')

  let log = ''
  const timeout = setTimeout(() => reject(new Error('Timed out waiting for the upload token')), 10_000)
  for (const stream of [server.stdout, server.stderr]) {
    stream.on('data', (chunk) => {
      const text = chunk.toString()
      log = (log + text).slice(-16_384)
      process.stderr.write(`[treetop] ${text.replace(/("token":")[^"]+/, '$1<redacted>')}`)
      const match = log.match(/"Uploads enabled","token":"([^"]+)"/)
      if (match) {
        clearTimeout(timeout)
        resolve(match[1])
      }
    })
  }
})

try {
  const token = await tokenPromise
  const baseUrl = `http://127.0.0.1:${serverPort}`
  await waitForHttp(`${baseUrl}/livez`)
  if (manifest.schema !== false) {
    await uploadFixture({ baseUrl, pathname: 'schema', file: path.join(directory, 'schema.json'), token, accessToken })
  }
  await uploadFixture({ baseUrl, pathname: 'policies', file: path.join(directory, 'policies.cedar'), token, accessToken })
  await waitForHttp(`${baseUrl}/readyz`)

  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  watch(spawn(npm, [
    'run', 'dev', '--',
    '--host', '127.0.0.1',
    '--port', String(frontendPort),
    '--strictPort',
  ], {
    cwd: root,
    env: {
      ...process.env,
      VITE_TREETOP_PROXY_TARGET: baseUrl,
      TREETOP_PROXY_ACCESS_TOKEN: accessToken,
    },
    stdio: 'inherit',
  }), 'Vite')
  await waitForHttp(`http://127.0.0.1:${frontendPort}`)

  console.log(`\nTreetop demo: ${manifest.name}`)
  console.log(`  Frontend  http://127.0.0.1:${frontendPort}`)
  console.log(`  REST API  ${baseUrl}`)
  console.log(`  Policies  demo/environments/${requested}/policies.cedar`)
  console.log(`  Source    ${manifest.source}`)
  printExamples(manifest, requested)
  console.log('\nPress Ctrl+C to stop both processes.')
  await lifetime
} finally {
  await shutdown()
}
