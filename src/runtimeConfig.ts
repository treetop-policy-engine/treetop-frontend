export type RuntimeConfiguration = {
  apiUrl?: string
  serverProfiles?: string
  activeServer?: string
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function serverProfilesValue(value: unknown): string | undefined {
  if (nonEmptyString(value)) return value.trim()
  if (!value || typeof value !== 'object') return undefined
  try {
    return JSON.stringify(value)
  } catch {
    return undefined
  }
}

/**
 * Read public deployment configuration generated before the application starts.
 * Invalid values are ignored so a malformed optional file cannot replace the
 * build-time defaults with unusable data.
 */
export function readRuntimeConfiguration(value: unknown): RuntimeConfiguration {
  if (!value || typeof value !== 'object') return {}
  const candidate = value as Record<string, unknown>
  return {
    apiUrl: nonEmptyString(candidate.apiUrl) ? candidate.apiUrl.trim() : undefined,
    serverProfiles: serverProfilesValue(candidate.serverProfiles),
    activeServer: nonEmptyString(candidate.activeServer) ? candidate.activeServer.trim() : undefined,
  }
}

export function browserRuntimeConfiguration(): RuntimeConfiguration {
  return readRuntimeConfiguration(globalThis.window?.__TREETOP_CONFIG__)
}
