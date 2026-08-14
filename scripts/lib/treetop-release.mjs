import { createWriteStream } from 'node:fs'
import fs from 'node:fs/promises'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'

async function exists(file) {
  try {
    await fs.access(file)
    return true
  } catch {
    return false
  }
}

function releaseArchitecture() {
  if (process.platform !== 'linux') {
    throw new Error(
      'Official treetop-rest binaries are Linux-only. Set TREETOP_SERVER_BIN to a locally built treetop-server, or use the Docker demo.',
    )
  }
  if (process.arch === 'x64') return 'x86_64'
  if (process.arch === 'arm64') return 'aarch64'
  throw new Error(`Unsupported release architecture: ${process.arch}`)
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

export async function ensureTreetopServer({ root = process.cwd(), release = 'v0.0.12' } = {}) {
  const override = process.env.TREETOP_SERVER_BIN
  if (override) {
    const resolved = path.resolve(root, override)
    await fs.access(resolved)
    return resolved
  }
  if (!/^v[0-9A-Za-z._-]+$/.test(release)) throw new Error(`Invalid release name: ${release}`)

  const cacheDir = path.join(root, '.cache', 'treetop-rest', release)
  const binary = path.join(cacheDir, 'treetop-server')
  const archive = path.join(cacheDir, 'treetop-server.tar.gz')
  if (await exists(binary)) return binary

  await fs.mkdir(cacheDir, { recursive: true })
  if (!(await exists(archive))) {
    const arch = releaseArchitecture()
    const url = `https://github.com/treetop-policy-engine/treetop-rest/releases/download/${release}/treetop-server-${arch}-linux-musl.tar.gz`
    console.log(`Downloading treetop-rest ${release} (${arch})…`)
    const response = await fetch(url, { redirect: 'follow' })
    if (!response.ok || !response.body) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`)
    }
    await pipeline(Readable.fromWeb(response.body), createWriteStream(archive))
  }

  await run('tar', ['-xzf', archive, '-C', cacheDir])
  await fs.chmod(binary, 0o755)
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
