import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  TreetopClient,
  validateBrowserAccessToken,
  type SchemaDownload,
  type StatusResponse,
  type VersionInfo,
} from '../api/client'
import { parseCedarSchema, type CedarSchemaModel } from '../domain/schema'
import { browserRuntimeConfiguration } from '../runtimeConfig'
import {
  chooseActiveServer,
  configuredServerProfiles,
  mergeServerProfiles,
  migrateLegacyServer,
  parseServerProfileConfiguration,
  readStoredServerProfiles,
  saveBrowserServer,
  type ServerProfile,
  type ServerProfileInput,
  writeStoredServerProfiles,
} from './serverProfiles'

type WorkspaceSnapshot = {
  status?: StatusResponse
  version?: VersionInfo
  schema?: SchemaDownload
  schemaModel?: CedarSchemaModel
}

type WorkspaceContextValue = WorkspaceSnapshot & {
  servers: ServerProfile[]
  activeServer: ServerProfile
  baseUrl: string
  client: TreetopClient
  loading: boolean
  error?: Error
  accessTokenConfigured: (serverId: string) => boolean
  authenticationRequired: boolean
  connect: (serverId: string) => void
  saveServer: (input: ServerProfileInput, editingId?: string, accessToken?: string) => string
  setAccessToken: (serverId: string, accessToken: string) => void
  clearAccessToken: (serverId: string) => void
  removeServer: (serverId: string) => void
  refresh: () => Promise<void>
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)
const runtimeConfiguration = browserRuntimeConfiguration()
const defaultUrl = runtimeConfiguration.apiUrl ?? import.meta.env.VITE_TREETOP_API_URL ?? '/treetop-api'
const configuredProfileData = parseServerProfileConfiguration(
  runtimeConfiguration.serverProfiles ?? import.meta.env.VITE_TREETOP_SERVER_PROFILES,
)
const configuredDefault = configuredProfileData?.defaultServer
  ?? runtimeConfiguration.activeServer
  ?? import.meta.env.VITE_TREETOP_ACTIVE_SERVER

function browserStorage() {
  try {
    return localStorage
  } catch {
    return undefined
  }
}

function initialConnections() {
  const storage = browserStorage()
  const configured = configuredServerProfiles(configuredProfileData, defaultUrl)
  const stored = readStoredServerProfiles(storage)
  const merged = mergeServerProfiles(configured, stored)
  const migrated = migrateLegacyServer(storage, merged)
  const activeServer = chooseActiveServer(
    migrated.profiles,
    stored.activeServer ?? migrated.activeServer,
    configuredDefault,
  )
  return { profiles: migrated.profiles, activeServer }
}

const initial = initialConnections()

export function WorkspaceProvider({ children }: PropsWithChildren) {
  const [servers, setServers] = useState(initial.profiles)
  const [activeServerId, setActiveServerId] = useState(initial.activeServer)
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error>()
  const [accessTokens, setAccessTokens] = useState<Record<string, string>>({})
  const [authenticationRequired, setAuthenticationRequired] = useState(false)
  const refreshSequence = useRef(0)
  const activeServer = servers.find(({ id }) => id === activeServerId) ?? servers[0]
  const baseUrl = activeServer.baseUrl
  const activeAccessToken = accessTokens[activeServer.id]
  const client = useMemo(() => new TreetopClient(baseUrl, {
    accessToken: activeAccessToken,
    onUnauthorized: () => {
      setAuthenticationRequired(true)
      setAccessTokens((current) => {
        if (!(activeServer.id in current)) return current
        const next = { ...current }
        delete next[activeServer.id]
        return next
      })
    },
  }), [baseUrl, activeAccessToken, activeServer.id])

  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current
    setLoading(true)
    setError(undefined)
    try {
      const [status, version, schema] = await Promise.all([
        client.status(),
        client.version(),
        client.schema(),
      ])
      let schemaModel: CedarSchemaModel | undefined
      if (schema.schema.content.trim()) schemaModel = parseCedarSchema(schema.schema.content)
      if (sequence === refreshSequence.current) {
        setSnapshot({ status, version, schema, schemaModel })
        setAuthenticationRequired(false)
      }
    } catch (cause) {
      if (sequence === refreshSequence.current) {
        setSnapshot({})
        setError(cause instanceof Error ? cause : new Error(String(cause)))
      }
    } finally {
      if (sequence === refreshSequence.current) setLoading(false)
    }
  }, [client])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    writeStoredServerProfiles(browserStorage(), servers, activeServerId)
  }, [servers, activeServerId])

  const connect = useCallback((serverId: string) => {
    if (!servers.some(({ id }) => id === serverId)) return
    if (serverId === activeServerId) {
      void refresh()
      return
    }
    refreshSequence.current += 1
    setSnapshot({})
    setError(undefined)
    setAuthenticationRequired(false)
    setLoading(true)
    setActiveServerId(serverId)
  }, [servers, activeServerId, refresh])

  const saveServer = useCallback((input: ServerProfileInput, editingId?: string, accessToken?: string) => {
    const previous = editingId ? servers.find(({ id }) => id === editingId) : undefined
    const result = saveBrowserServer(servers, input, editingId)
    const saved = result.profiles.find(({ id }) => id === result.savedId)!
    if (accessToken !== undefined) validateBrowserAccessToken(saved.baseUrl, accessToken)
    setServers(result.profiles)
    if (previous && previous.baseUrl !== saved.baseUrl) {
      setAccessTokens((current) => {
        const next = { ...current }
        delete next[result.savedId]
        return next
      })
    }
    if (accessToken !== undefined) {
      setAccessTokens((current) => ({ ...current, [result.savedId]: accessToken }))
      setAuthenticationRequired(false)
    }
    if (editingId === activeServerId) {
      refreshSequence.current += 1
      setSnapshot({})
      setError(undefined)
      setLoading(true)
    }
    return result.savedId
  }, [servers, activeServerId])

  const setAccessToken = useCallback((serverId: string, accessToken: string) => {
    const server = servers.find(({ id }) => id === serverId)
    if (!server) throw new Error('Select a server before configuring its access token.')
    validateBrowserAccessToken(server.baseUrl, accessToken)
    setAccessTokens((current) => ({ ...current, [serverId]: accessToken }))
    setAuthenticationRequired(false)
  }, [servers])

  const clearAccessToken = useCallback((serverId: string) => {
    setAccessTokens((current) => {
      if (!(serverId in current)) return current
      const next = { ...current }
      delete next[serverId]
      return next
    })
  }, [])

  const removeServer = useCallback((serverId: string) => {
    const server = servers.find(({ id }) => id === serverId)
    if (!server || server.origin === 'configured') {
      throw new Error('Startup-configured servers cannot be removed here.')
    }
    if (serverId === activeServerId) throw new Error('Switch servers before removing the active connection.')
    setServers((current) => current.filter(({ id }) => id !== serverId))
    clearAccessToken(serverId)
  }, [servers, activeServerId, clearAccessToken])

  return (
    <WorkspaceContext.Provider
      value={{
        ...snapshot,
        servers,
        activeServer,
        baseUrl,
        client,
        loading,
        error,
        accessTokenConfigured: (serverId) => Boolean(accessTokens[serverId]),
        authenticationRequired,
        connect,
        saveServer,
        setAccessToken,
        clearAccessToken,
        removeServer,
        refresh,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  )
}

// Provider and hook intentionally live together so the context stays private.
// eslint-disable-next-line react-refresh/only-export-components
export function useWorkspace() {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error('useWorkspace must be used inside WorkspaceProvider')
  return value
}
