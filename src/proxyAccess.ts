const ACCESS_TOKEN_PATTERN = /^[A-Za-z0-9\-._~+/]+={0,}$/

export type ProxyAccessTokens = {
  defaultToken?: string
  byPrefix: ReadonlyMap<string, string>
}

function validateToken(token: string, source: string): string {
  if (!token || !ACCESS_TOKEN_PATTERN.test(token)) {
    throw new Error(`Invalid Bearer token in ${source}.`)
  }
  return token
}

function normalizePrefix(prefix: string): string | undefined {
  if (!prefix.startsWith('/') || prefix.includes('?') || prefix.includes('#')) return undefined
  return prefix.replace(/\/+$/, '') || undefined
}

export function parseProxyAccessTokens(
  defaultValue: string | undefined,
  mapValue: string | undefined,
): ProxyAccessTokens {
  const defaultToken = defaultValue?.trim()
    ? validateToken(defaultValue, 'TREETOP_PROXY_ACCESS_TOKEN')
    : undefined
  const byPrefix = new Map<string, string>()

  if (mapValue?.trim()) {
    let parsed: unknown
    try {
      parsed = JSON.parse(mapValue)
    } catch {
      throw new Error('TREETOP_PROXY_ACCESS_TOKENS must be a JSON object.')
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('TREETOP_PROXY_ACCESS_TOKENS must be a JSON object.')
    }
    for (const [rawPrefix, rawToken] of Object.entries(parsed)) {
      const prefix = normalizePrefix(rawPrefix)
      if (!prefix || typeof rawToken !== 'string') {
        throw new Error('TREETOP_PROXY_ACCESS_TOKENS contains an invalid entry.')
      }
      byPrefix.set(prefix, validateToken(rawToken, 'TREETOP_PROXY_ACCESS_TOKENS'))
    }
  }

  return { defaultToken, byPrefix }
}

export function isProtectedUpstreamPath(prefix: string, requestUrl: string): boolean {
  const pathname = new URL(requestUrl, 'http://vite.invalid').pathname
  const normalizedPrefix = prefix.replace(/\/+$/, '')
  const upstreamPath = pathname.startsWith(normalizedPrefix)
    ? pathname.slice(normalizedPrefix.length) || '/'
    : pathname
  return upstreamPath === '/metrics' || upstreamPath === '/api/v1' || upstreamPath.startsWith('/api/v1/')
}

export function proxyAuthorization(
  prefix: string,
  requestUrl: string,
  access: ProxyAccessTokens,
): string | undefined {
  if (!isProtectedUpstreamPath(prefix, requestUrl)) return undefined
  const token = access.byPrefix.get(prefix.replace(/\/+$/, '')) ?? access.defaultToken
  return token ? `Bearer ${token}` : undefined
}
