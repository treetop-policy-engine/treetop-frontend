import fs from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { REST_REF } from './treetop-contract.mjs'

async function exists(file) {
  try {
    await fs.access(file)
    return true
  } catch {
    return false
  }
}

export function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} exited with ${code ?? signal}`))
    })
  })
}

export async function ensureTreetopServer({ root = process.cwd() } = {}) {
  const override = process.env.TREETOP_SERVER_BIN
  if (override) {
    const resolved = path.resolve(root, override)
    await fs.access(resolved)
    return resolved
  }
  const cacheDir = path.join(root, '.cache', 'treetop-rest', REST_REF)
  const source = path.join(cacheDir, 'source')
  const target = path.join(cacheDir, 'target')
  const binary = path.join(target, 'release', process.platform === 'win32' ? 'treetop-server.exe' : 'treetop-server')
  if (await exists(binary)) return binary
  await fs.mkdir(source, { recursive: true })
  if (!(await exists(path.join(source, '.git')))) {
    await run('git', ['init', source])
    await run('git', ['-C', source, 'remote', 'add', 'origin', 'https://github.com/treetop-policy-engine/treetop-rest.git'])
  }
  await run('git', ['-C', source, 'fetch', '--depth=1', 'origin', REST_REF])
  await run('git', ['-C', source, 'checkout', '--detach', REST_REF])
  await run('cargo', ['build', '--locked', '--release', '--bin', 'treetop-server'], {
    cwd: source,
    env: { ...process.env, CARGO_TARGET_DIR: target },
  })
  return binary
}

export async function waitForHttp(url, { timeout = 15_000, accept = (response) => response.ok } = {}) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (await accept(response)) return response
    } catch {
      // The process may still be binding its socket.
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out waiting for ${url}`)
}

export async function uploadFixture({ baseUrl, pathname, file, token, accessToken }) {
  const body = await fs.readFile(file, 'utf8')
  const response = await fetch(`${baseUrl}/api/v1/${pathname}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
      'X-Upload-Token': token,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body,
  })
  if (!response.ok) {
    throw new Error(`Failed to upload ${file}: ${response.status} ${await response.text()}`)
  }
  return response
}
