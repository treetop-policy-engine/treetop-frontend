import { describe, expect, it } from 'vitest'
import { isProtectedUpstreamPath, parseProxyAccessTokens, proxyAuthorization } from './proxyAccess'

describe('development proxy access tokens', () => {
  it('parses a default and path-specific overrides without returning values in errors', () => {
    const access = parseProxyAccessTokens(
      'default-token',
      JSON.stringify({ '/treetop-test': 'test-token', '/treetop-production/': 'prod-token' }),
    )

    expect(proxyAuthorization('/treetop-test', '/treetop-test/api/v1/status', access))
      .toBe('Bearer test-token')
    expect(proxyAuthorization('/treetop-production', '/treetop-production/metrics', access))
      .toBe('Bearer prod-token')
    expect(proxyAuthorization('/treetop-other', '/treetop-other/api/v1/status', access))
      .toBe('Bearer default-token')
  })

  it('injects only for protected upstream paths', () => {
    const access = parseProxyAccessTokens('default-token', undefined)

    expect(isProtectedUpstreamPath('/treetop-api', '/treetop-api/api/v1/status?full=true')).toBe(true)
    expect(isProtectedUpstreamPath('/treetop-api', '/treetop-api/metrics')).toBe(true)
    expect(proxyAuthorization('/treetop-api', '/treetop-api/livez', access)).toBeUndefined()
    expect(proxyAuthorization('/treetop-api', '/treetop-api/readyz', access)).toBeUndefined()
    expect(proxyAuthorization('/treetop-api', '/treetop-api/openapi.json', access)).toBeUndefined()
  })

  it('fails closed on malformed maps and credentials without exposing their values', () => {
    for (const raw of ['{broken', '[]', '{"relative":"token"}', '{"/test":"bad token"}']) {
      expect(() => parseProxyAccessTokens(undefined, raw)).toThrow()
      try {
        parseProxyAccessTokens(undefined, raw)
      } catch (error) {
        expect(String(error)).not.toContain(raw)
        expect(String(error)).not.toContain('bad token')
      }
    }
  })
})
