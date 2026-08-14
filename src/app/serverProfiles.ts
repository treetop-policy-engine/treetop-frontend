export type ServerProfileOrigin = 'configured' | 'browser'

export type ServerProfile = {
  id: string
  name: string
  baseUrl: string
  origin: ServerProfileOrigin
}

export type ServerProfileInput = {
  id?: string
  name: string
  url: string
}

export type ServerProfileConfiguration = {
  servers: ServerProfileInput[]
  defaultServer?: string
}

export type StoredServerProfiles = {
  activeServer?: string
  servers: ServerProfileInput[]
}

export const SERVER_PROFILES_STORAGE_KEY = 'treetop.serverProfiles.v1'
export const LEGACY_SERVER_URL_STORAGE_KEY = 'treetop.baseUrl'

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function validInput(value: unknown): value is ServerProfileInput {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ServerProfileInput>
  return nonEmptyString(candidate.name) && nonEmptyString(candidate.url)
    && (candidate.id === undefined || nonEmptyString(candidate.id))
}

function normalizeId(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
}

function configuredId(input: ServerProfileInput, index: number) {
  return normalizeId(input.id ?? input.name) || `server-${index + 1}`
}

function browserId() {
  const uuid = globalThis.crypto?.randomUUID?.()
  return `browser-${uuid ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`
}

function normalizeInput(input: ServerProfileInput, id: string, origin: ServerProfileOrigin): ServerProfile {
  return {
    id,
    name: input.name.trim(),
    baseUrl: input.url.trim().replace(/\/+$/, '') || '/',
    origin,
  }
}

export function parseServerProfileConfiguration(raw: string | undefined): ServerProfileConfiguration | undefined {
  if (!raw?.trim()) return undefined
  try {
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) {
      const servers = parsed.filter(validInput)
      return servers.length ? { servers } : undefined
    }
    if (!parsed || typeof parsed !== 'object') return undefined
    const value = parsed as { servers?: unknown; defaultServer?: unknown }
    if (!Array.isArray(value.servers)) return undefined
    const servers = value.servers.filter(validInput)
    if (!servers.length) return undefined
    return {
      servers,
      defaultServer: nonEmptyString(value.defaultServer) ? value.defaultServer.trim() : undefined,
    }
  } catch {
    return undefined
  }
}

export function configuredServerProfiles(
  configuration: ServerProfileConfiguration | undefined,
  fallbackUrl: string,
): ServerProfile[] {
  const inputs = configuration?.servers.filter(validInput) ?? []
  if (!inputs.length) {
    return [normalizeInput({ id: 'default', name: 'Default', url: fallbackUrl }, 'default', 'configured')]
  }

  const seen = new Set<string>()
  return inputs.flatMap((input, index) => {
    const id = configuredId(input, index)
    if (seen.has(id)) return []
    seen.add(id)
    return [normalizeInput(input, id, 'configured')]
  })
}

export function readStoredServerProfiles(storage: Storage | undefined): StoredServerProfiles {
  if (!storage) return { servers: [] }
  try {
    const raw = storage.getItem(SERVER_PROFILES_STORAGE_KEY)
    if (!raw) return { servers: [] }
    const parsed = JSON.parse(raw) as { activeServer?: unknown; servers?: unknown }
    return {
      activeServer: nonEmptyString(parsed.activeServer) ? parsed.activeServer : undefined,
      servers: Array.isArray(parsed.servers) ? parsed.servers.filter(validInput) : [],
    }
  } catch {
    return { servers: [] }
  }
}

export function writeStoredServerProfiles(
  storage: Storage | undefined,
  profiles: ServerProfile[],
  activeServer: string,
) {
  if (!storage) return
  const servers = profiles
    .filter(({ origin }) => origin === 'browser')
    .map(({ id, name, baseUrl }) => ({ id, name, url: baseUrl }))
  try {
    storage.setItem(SERVER_PROFILES_STORAGE_KEY, JSON.stringify({ activeServer, servers }))
    storage.removeItem(LEGACY_SERVER_URL_STORAGE_KEY)
  } catch {
    // The workbench remains usable when browser storage is disabled.
  }
}

export function mergeServerProfiles(configured: ServerProfile[], stored: StoredServerProfiles): ServerProfile[] {
  const ids = new Set(configured.map(({ id }) => id))
  const browser = stored.servers.flatMap((input) => {
    const id = normalizeId(input.id ?? '') || browserId()
    if (ids.has(id)) return []
    ids.add(id)
    return [normalizeInput(input, id, 'browser')]
  })
  return [...configured, ...browser]
}

export function migrateLegacyServer(
  storage: Storage | undefined,
  profiles: ServerProfile[],
): { profiles: ServerProfile[]; activeServer?: string } {
  if (!storage) return { profiles }
  try {
    const legacyUrl = storage.getItem(LEGACY_SERVER_URL_STORAGE_KEY)?.trim().replace(/\/+$/, '')
    if (!legacyUrl) return { profiles }
    const existing = profiles.find(({ baseUrl }) => baseUrl === legacyUrl)
    if (existing) return { profiles, activeServer: existing.id }
    const profile = normalizeInput({ name: 'Previous server', url: legacyUrl }, browserId(), 'browser')
    return { profiles: [...profiles, profile], activeServer: profile.id }
  } catch {
    return { profiles }
  }
}

export function chooseActiveServer(
  profiles: ServerProfile[],
  storedActive: string | undefined,
  configuredDefault: string | undefined,
) {
  const requested = [storedActive, configuredDefault].find(
    (id): id is string => Boolean(id && profiles.some((profile) => profile.id === id)),
  )
  return requested ?? profiles[0].id
}

export function saveBrowserServer(
  profiles: ServerProfile[],
  input: ServerProfileInput,
  editingId?: string,
): { profiles: ServerProfile[]; savedId: string } {
  if (!nonEmptyString(input.name) || !nonEmptyString(input.url)) {
    throw new Error('Server name and URL are required.')
  }
  const editing = editingId ? profiles.find(({ id }) => id === editingId) : undefined
  if (editing?.origin === 'configured') throw new Error('Startup-configured servers cannot be edited here.')
  const id = editing?.id ?? browserId()
  const saved = normalizeInput(input, id, 'browser')
  return {
    profiles: editing
      ? profiles.map((profile) => profile.id === id ? saved : profile)
      : [...profiles, saved],
    savedId: id,
  }
}
