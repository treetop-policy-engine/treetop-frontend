import { createServer } from 'node:http'
import fs from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { ensureTreetopServer, uploadFixture, waitForHttp } from './lib/treetop-release.mjs'

const root = process.cwd()
const environmentsRoot = path.join(root, 'demo', 'environments')
const release = process.env.TREETOP_REST_VERSION ?? 'v0.0.12'
const serverPort = Number(process.env.TREETOP_DEMO_TEST_SERVER_PORT ?? 19997)
const fixturesPort = Number(process.env.TREETOP_DEMO_TEST_FIXTURES_PORT ?? 18081)
const binary = await ensureTreetopServer({ root, release })
const accessToken = 'frontend-demo-test-access-token'
const authorization = { Authorization: `Bearer ${accessToken}` }

function qualified(value) {
  const parts = value.split('::')
  const id = parts.pop()
  const kind = parts.pop()
  return { kind, id, namespace: parts }
}

function typedValue(value, cedarType) {
  if (cedarType?.type === 'Extension' && ['ip', 'ipaddr'].includes(cedarType.name)) {
    return { type: 'Ip', value }
  }
  if (typeof value === 'boolean') return { type: 'Bool', value }
  if (typeof value === 'number') return { type: 'Long', value }
  return { type: 'String', value }
}

function fieldsFor(schema, example) {
  if (!schema) return { attributes: {}, context: {} }
  const resourceParts = example.resource.split('::')
  const resourceName = resourceParts.pop()
  const namespace = resourceParts.join('::')
  const action = qualified(example.action)
  const definition = schema[namespace] ?? {}
  const attributes = definition.entityTypes?.[resourceName]?.shape?.attributes ?? {}
  const rawContext = definition.actions?.[action.id]?.appliesTo?.context ?? {}
  const context = definition.commonTypes?.[rawContext.type] ?? rawContext
  return { attributes, context: context.attributes ?? {} }
}

function requestFor(example, schema) {
  const principal = qualified(example.principal)
  const action = qualified(example.action)
  const resource = qualified(example.resource)
  const groups = (example.groups ?? []).map((id) => ({ id, namespace: principal.namespace }))
  const fields = fieldsFor(schema, example)
  return {
    requests: [{
      id: 'demo-check',
      principal: principal.kind === 'Group'
        ? { Group: { id: principal.id, namespace: principal.namespace } }
        : { User: { id: principal.id, namespace: principal.namespace, groups } },
      action: { id: action.id, namespace: action.namespace },
      resource: {
        kind: example.resource,
        id: example.resourceId,
        ...(example.attributes && Object.keys(example.attributes).length
          ? { attrs: Object.fromEntries(Object.entries(example.attributes).map(([name, value]) => [name, typedValue(value, fields.attributes[name])])) }
          : {}),
      },
      ...(example.context && Object.keys(example.context).length
        ? { context: Object.fromEntries(Object.entries(example.context).map(([name, value]) => [name, typedValue(value, fields.context[name])])) }
        : {}),
    }],
  }
}

function startFixtureServer(directory) {
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
    if (pathname !== '/labels.json') return response.writeHead(404).end('Not found')
    try {
      const content = await fs.readFile(path.join(directory, 'labels.json'))
      response.writeHead(200, { 'Content-Type': 'application/json' }).end(content)
    } catch {
      response.writeHead(500).end('Fixture unavailable')
    }
  })
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(fixturesPort, '127.0.0.1', () => resolve(server))
  })
}

function closeServer(server) {
  return new Promise((resolve) => server.close(resolve))
}

async function testEnvironment(name) {
  const directory = path.join(environmentsRoot, name)
  const manifest = JSON.parse(await fs.readFile(path.join(directory, 'demo.json'), 'utf8'))
  const schema = manifest.schema === false
    ? undefined
    : JSON.parse(await fs.readFile(path.join(directory, 'schema.json'), 'utf8'))
  const fixtureServer = await startFixtureServer(directory)
  let tokenResolve
  let tokenReject
  const tokenPromise = new Promise((resolve, reject) => {
    tokenResolve = resolve
    tokenReject = reject
  })
  const server = spawn(binary, [
    '--port', String(serverPort),
    '--allow-upload',
    '--schema-validation-mode', manifest.schema === false ? 'permissive' : 'strict',
    '--labels-url', `http://127.0.0.1:${fixturesPort}/labels.json`,
    '--labels-refresh', '1',
    '--workers', '1',
    '--rayon-threads', '1',
  ], {
    env: { ...process.env, TREETOP_ACCESS_TOKENS: accessToken, RUST_LOG: 'warn' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let log = ''
  for (const stream of [server.stdout, server.stderr]) {
    stream.on('data', (chunk) => {
      log = (log + chunk.toString()).slice(-16_384)
      const match = log.match(/"Uploads enabled","token":"([^"]+)"/)
      if (match) tokenResolve(match[1])
    })
  }
  server.once('error', tokenReject)
  server.once('exit', (code) => tokenReject(new Error(`treetop-server exited during ${name} setup (${code})`)))

  try {
    const token = await Promise.race([
      tokenPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(`No upload token for ${name}`)), 10_000)),
    ])
    const baseUrl = `http://127.0.0.1:${serverPort}`
    await waitForHttp(`${baseUrl}/livez`)
    if (manifest.schema !== false) {
      await uploadFixture({ baseUrl, pathname: 'schema', file: path.join(directory, 'schema.json'), token, accessToken })
    }
    await uploadFixture({ baseUrl, pathname: 'policies', file: path.join(directory, 'policies.cedar'), token, accessToken })
    await waitForHttp(`${baseUrl}/readyz`)

    const status = await fetch(`${baseUrl}/api/v1/status`, { headers: authorization }).then((response) => response.json())
    if (status.request_context.schema_backed !== (manifest.schema !== false)) {
      throw new Error(`${name}: unexpected schema-backed status`)
    }

    for (const example of manifest.examples ?? []) {
      const body = example.requestFile
        ? JSON.parse(await fs.readFile(path.join(directory, example.requestFile), 'utf8'))
        : requestFor(example, schema)
      const response = await fetch(`${baseUrl}/api/v1/authorize?detail=full`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authorization },
        body: JSON.stringify(body),
      })
      const result = await response.json()
      const actual = result.results?.[0]?.result?.decision
      if (!response.ok || actual !== example.outcome[0] + example.outcome.slice(1).toLowerCase()) {
        throw new Error(`${name}: “${example.summary}” expected ${example.outcome}, got ${JSON.stringify(result)}`)
      }
    }

    const lookupExample = manifest.examples?.find(({ outcome }) => outcome === 'ALLOW')
    if (lookupExample) {
      const principal = qualified(lookupExample.principal)
      const query = new URLSearchParams()
      principal.namespace.forEach((part) => query.append('namespaces[]', part))
      ;(lookupExample.groups ?? []).forEach((group) => query.append('groups[]', group))
      const lookup = await fetch(
        `${baseUrl}/api/v1/policies/${encodeURIComponent(principal.id)}?${query.toString()}`,
        { headers: authorization },
      ).then((response) => response.json())
      if (!lookup.matches?.length) {
        throw new Error(`${name}: principal lookup returned no policies for ${lookupExample.principal}`)
      }
      query.set('format', 'raw')
      const matchingSource = await fetch(
        `${baseUrl}/api/v1/policies/${encodeURIComponent(principal.id)}?${query.toString()}`,
        { headers: { Accept: 'text/plain', ...authorization } },
      ).then((response) => response.text())
      if (!matchingSource.includes('permit')) {
        throw new Error(`${name}: raw principal lookup returned no Cedar policy source`)
      }
    }
    console.log(`✓ ${name}: ${manifest.examples.length} decisions + principal lookup, schema ${manifest.schema === false ? 'absent' : 'backed'}`)
  } finally {
    const exited = server.exitCode === null
      ? new Promise((resolve) => server.once('exit', resolve))
      : Promise.resolve()
    server.kill('SIGTERM')
    await closeServer(fixtureServer)
    await Promise.race([
      exited,
      new Promise((resolve) => setTimeout(resolve, 2_000)),
    ])
  }
}

const environments = (await fs.readdir(environmentsRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

for (const environment of environments) await testEnvironment(environment)
console.log(`\n${environments.length} demo environments passed against treetop-rest ${release}.`)
