import { beforeEach, describe, expect, it } from 'vitest'
import {
  chooseActiveServer,
  configuredServerProfiles,
  mergeServerProfiles,
  migrateLegacyServer,
  parseServerProfileConfiguration,
  readStoredServerProfiles,
  saveBrowserServer,
  SERVER_PROFILES_STORAGE_KEY,
} from './serverProfiles'

describe('server profiles', () => {
  let storage: Storage

  beforeEach(() => {
    const values = new Map<string, string>()
    storage = {
      get length() { return values.size },
      clear: () => values.clear(),
      getItem: (key) => values.get(key) ?? null,
      key: (index) => [...values.keys()][index] ?? null,
      removeItem: (key) => { values.delete(key) },
      setItem: (key, value) => { values.set(key, value) },
    }
  })

  it('parses configured profiles and selects the configured default', () => {
    const configuration = parseServerProfileConfiguration(JSON.stringify({
      defaultServer: 'prod',
      servers: [
        { id: 'test', name: 'Test', url: '/treetop-test/' },
        { id: 'prod', name: 'Production', url: '/treetop-prod' },
      ],
    }))
    const profiles = configuredServerProfiles(configuration, '/fallback')

    expect(profiles).toEqual([
      { id: 'test', name: 'Test', baseUrl: '/treetop-test', origin: 'configured' },
      { id: 'prod', name: 'Production', baseUrl: '/treetop-prod', origin: 'configured' },
    ])
    expect(chooseActiveServer(profiles, undefined, configuration?.defaultServer)).toBe('prod')
  })

  it('ignores malformed configuration and falls back to the legacy URL setting', () => {
    expect(parseServerProfileConfiguration('{broken')).toBeUndefined()
    expect(configuredServerProfiles(undefined, '/treetop-api')).toEqual([
      { id: 'default', name: 'Default', baseUrl: '/treetop-api', origin: 'configured' },
    ])
  })

  it('loads browser profiles without allowing them to replace configured profiles', () => {
    storage.setItem(SERVER_PROFILES_STORAGE_KEY, JSON.stringify({
      activeServer: 'local',
      servers: [
        { id: 'prod', name: 'Fake production', url: '/fake' },
        { id: 'local', name: 'Local', url: 'http://127.0.0.1:9999/' },
      ],
    }))
    const configured = configuredServerProfiles({
      servers: [{ id: 'prod', name: 'Production', url: '/prod' }],
    }, '/fallback')
    const stored = readStoredServerProfiles(storage)
    const profiles = mergeServerProfiles(configured, stored)

    expect(profiles).toHaveLength(2)
    expect(profiles[0].name).toBe('Production')
    expect(profiles[1]).toMatchObject({ id: 'local', baseUrl: 'http://127.0.0.1:9999' })
    expect(chooseActiveServer(profiles, stored.activeServer, undefined)).toBe('local')
  })

  it('migrates the previously saved server URL', () => {
    storage.setItem('treetop.baseUrl', 'http://old.example.test/')
    const configured = configuredServerProfiles(undefined, '/treetop-api')
    const migrated = migrateLegacyServer(storage, configured)

    expect(migrated.profiles).toHaveLength(2)
    expect(migrated.profiles[1]).toMatchObject({
      name: 'Previous server',
      baseUrl: 'http://old.example.test',
      origin: 'browser',
    })
    expect(migrated.activeServer).toBe(migrated.profiles[1].id)
  })

  it('adds and edits browser-managed profiles', () => {
    const configured = configuredServerProfiles(undefined, '/treetop-api')
    const added = saveBrowserServer(configured, { name: 'Test', url: '/test/' })
    const edited = saveBrowserServer(
      added.profiles,
      { name: 'Test cluster', url: '/test-v2' },
      added.savedId,
    )

    expect(edited.savedId).toBe(added.savedId)
    expect(edited.profiles[1]).toMatchObject({ name: 'Test cluster', baseUrl: '/test-v2' })
    expect(() => saveBrowserServer(edited.profiles, { name: 'No', url: '/no' }, 'default'))
      .toThrow('Startup-configured servers cannot be edited here.')
  })
})
