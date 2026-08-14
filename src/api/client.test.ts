import { afterEach, describe, expect, it, vi } from 'vitest'
import { TreetopApiError, TreetopClient, validateBrowserAccessToken } from './client'

function ok(body = '{}', contentType = 'application/json') {
  return new Response(body, { status: 200, headers: { 'Content-Type': contentType } })
}

describe('TreetopClient access tokens', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('adds Bearer authorization only to protected paths', async () => {
    const requests: Array<{ url: string; authorization: string | null }> = []
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      requests.push({
        url: String(input),
        authorization: new Headers(init?.headers).get('Authorization'),
      })
      return String(input).endsWith('/metrics') || String(input).endsWith('/livez') || String(input).endsWith('/readyz')
        ? ok('ok\n', 'text/plain')
        : ok()
    }))
    const client = new TreetopClient('/treetop-api', { accessToken: 'memory-only-token' })

    await client.status()
    await client.metrics()
    await client.live()
    await client.ready()
    await client.openapi()

    expect(requests.map(({ url, authorization }) => [new URL(url, location.href).pathname, authorization]))
      .toEqual([
        ['/treetop-api/api/v1/status', 'Bearer memory-only-token'],
        ['/treetop-api/metrics', 'Bearer memory-only-token'],
        ['/treetop-api/livez', null],
        ['/treetop-api/readyz', null],
        ['/treetop-api/openapi.json', null],
      ])
  })

  it('clears rejected credentials through the unauthorized callback', async () => {
    const onUnauthorized = vi.fn()
    vi.stubGlobal('fetch', vi.fn(async () => new Response('rejected-token', { status: 401 })))
    const client = new TreetopClient('/treetop-api', {
      accessToken: 'rejected-token',
      onUnauthorized,
    })

    const error = await client.status().catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(TreetopApiError)
    expect((error as Error).message).toBe('Access token required or rejected.')
    expect((error as Error).message).not.toContain('rejected-token')
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  it('redacts a token echoed by a non-authentication error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: 'bad secret-token', code: 'bad_request' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )))
    const client = new TreetopClient('/treetop-api', { accessToken: 'secret-token' })

    const error = await client.status().catch((cause: unknown) => cause)

    expect((error as Error).message).toBe('bad <redacted>')
  })

  it('rejects malformed tokens and non-loopback plaintext servers without echoing tokens', () => {
    const secret = 'invalid token value'
    expect(() => validateBrowserAccessToken('/treetop-api', secret)).toThrow('invalid characters')
    try {
      validateBrowserAccessToken('/treetop-api', secret)
    } catch (error) {
      expect(String(error)).not.toContain(secret)
    }
    expect(() => validateBrowserAccessToken('http://example.test', 'valid-token'))
      .toThrow('require HTTPS outside loopback')
    expect(() => validateBrowserAccessToken('http://127.0.0.2:9999', 'valid-token')).not.toThrow()
  })
})
