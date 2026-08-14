import type { components } from './generated'

export type ApiSchema = components['schemas']
export type StatusResponse = ApiSchema['StatusResponse']
export type VersionInfo = ApiSchema['VersionInfo']
export type SchemaDownload = ApiSchema['SchemaDownload']
export type PoliciesDownload = ApiSchema['PoliciesDownload']
export type UserPolicies = ApiSchema['UserPolicies']
export type AuthorizeRequest = ApiSchema['AuthorizeRequest']
export type AttrValue = ApiSchema['AttrValue']
export type AuthRequest = ApiSchema['AuthRequest']
export type PolicyVersion = ApiSchema['PolicyVersion']
export type PermitPolicy = ApiSchema['PermitPolicy']

export type AuthorizeDecision = {
  decision: 'Allow' | 'Deny'
  version: PolicyVersion
  policy_id?: string
  policy?: PermitPolicy[]
}

export type AuthorizeResult = {
  index: number
  id?: string | null
  status: 'success' | 'failed'
  result?: AuthorizeDecision
  error?: string
}

export type AuthorizeResponse = {
  results: AuthorizeResult[]
  version: PolicyVersion
  successful: number
  failed: number
}

type ApiErrorBody = Partial<ApiSchema['ErrorResponse']>

const ACCESS_TOKEN_PATTERN = /^[A-Za-z0-9\-._~+/]+={0,}$/

export class TreetopApiError extends Error {
  readonly status: number
  readonly code?: string
  readonly details?: { line?: number | null; column?: number | null } | null

  constructor(status: number, body: ApiErrorBody | string) {
    const message = typeof body === 'string' ? body : body.error ?? `Request failed (${status})`
    super(message)
    this.name = 'TreetopApiError'
    this.status = status
    if (typeof body !== 'string') {
      this.code = body.code
      this.details = body.details
    }
  }
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '')
  return trimmed.endsWith('/api/v1') ? trimmed.slice(0, -7) : trimmed
}

function browserLocation(): URL {
  return new URL(globalThis.location?.href ?? 'https://localhost/')
}

function isLoopback(hostname: string): boolean {
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return true
  if (hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]') return true
  const ipv4 = hostname.split('.').map(Number)
  return ipv4.length === 4 && ipv4.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
    && ipv4[0] === 127
}

export function validateBrowserAccessToken(baseUrl: string, accessToken: string): void {
  if (!ACCESS_TOKEN_PATTERN.test(accessToken)) {
    throw new Error('Access token contains invalid characters.')
  }
  const effectiveUrl = new URL(normalizeBaseUrl(baseUrl) || '/', browserLocation())
  if (effectiveUrl.protocol === 'http:' && !isLoopback(effectiveUrl.hostname)) {
    throw new Error('Access tokens require HTTPS outside loopback.')
  }
  if (effectiveUrl.protocol !== 'http:' && effectiveUrl.protocol !== 'https:') {
    throw new Error('Access tokens require an HTTP or HTTPS server URL.')
  }
}

type TreetopClientOptions = {
  accessToken?: string
  onUnauthorized?: () => void
}

export class TreetopClient {
  readonly baseUrl: string
  readonly #accessToken?: string
  readonly #onUnauthorized?: () => void

  constructor(baseUrl: string, options: TreetopClientOptions = {}) {
    this.baseUrl = normalizeBaseUrl(baseUrl)
    if (options.accessToken !== undefined) validateBrowserAccessToken(this.baseUrl, options.accessToken)
    this.#accessToken = options.accessToken
    this.#onUnauthorized = options.onUnauthorized
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const protectedPath = path === '/metrics' || path === '/api/v1' || path.startsWith('/api/v1/')
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(protectedPath && this.#accessToken ? { Authorization: `Bearer ${this.#accessToken}` } : {}),
        ...init?.headers,
      },
    })

    if (!response.ok) {
      if (response.status === 401) {
        this.#onUnauthorized?.()
        throw new TreetopApiError(401, {
          error: 'Access token required or rejected.',
          code: 'unauthorized',
        })
      }
      const body = await response.text()
      let parsed: ApiErrorBody | string = body || response.statusText
      try {
        parsed = JSON.parse(body) as ApiErrorBody
      } catch {
        // Plain-text operational errors are valid responses.
      }
      if (this.#accessToken) {
        if (typeof parsed === 'string') parsed = parsed.replaceAll(this.#accessToken, '<redacted>')
        else if (parsed.error) parsed = { ...parsed, error: parsed.error.replaceAll(this.#accessToken, '<redacted>') }
      }
      throw new TreetopApiError(response.status, parsed)
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('json')) return response.json() as Promise<T>
    return response.text() as Promise<T>
  }

  status() {
    return this.request<StatusResponse>('/api/v1/status')
  }

  version() {
    return this.request<VersionInfo>('/api/v1/version')
  }

  schema() {
    return this.request<SchemaDownload>('/api/v1/schema')
  }

  policies() {
    return this.request<PoliciesDownload>('/api/v1/policies')
  }

  authorize(body: AuthorizeRequest, detail: 'brief' | 'full' = 'full') {
    return this.request<AuthorizeResponse>(`/api/v1/authorize?detail=${detail}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  userPolicies(user: string, namespaces: string[] = [], groups: string[] = []) {
    const query = new URLSearchParams()
    namespaces.forEach((namespace) => query.append('namespaces[]', namespace))
    groups.forEach((group) => query.append('groups[]', group))
    const suffix = query.size ? `?${query.toString()}` : ''
    return this.request<UserPolicies>(`/api/v1/policies/${encodeURIComponent(user)}${suffix}`)
  }

  userPoliciesRaw(user: string, namespaces: string[] = [], groups: string[] = []) {
    const query = new URLSearchParams({ format: 'raw' })
    namespaces.forEach((namespace) => query.append('namespaces[]', namespace))
    groups.forEach((group) => query.append('groups[]', group))
    return this.request<string>(`/api/v1/policies/${encodeURIComponent(user)}?${query.toString()}`, {
      headers: { Accept: 'text/plain' },
    })
  }

  live() {
    return this.request<string>('/livez')
  }

  ready() {
    return this.request<string>('/readyz')
  }

  openapi() {
    return this.request<unknown>('/openapi.json')
  }

  metrics() {
    return this.request<string>('/metrics', { headers: { Accept: 'text/plain' } })
  }
}
