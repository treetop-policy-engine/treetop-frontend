import { describe, expect, it } from 'vitest'
import { readRuntimeConfiguration } from './runtimeConfig'

describe('runtime configuration', () => {
  it('reads non-empty public settings', () => {
    expect(readRuntimeConfiguration({
      apiUrl: ' /api ',
      serverProfiles: ' {"servers":[]} ',
      activeServer: ' production ',
      ignored: 'value',
    })).toEqual({
      apiUrl: '/api',
      serverProfiles: '{"servers":[]}',
      activeServer: 'production',
    })
  })

  it('ignores malformed and empty settings', () => {
    expect(readRuntimeConfiguration(undefined)).toEqual({})
    expect(readRuntimeConfiguration({ apiUrl: 42, serverProfiles: ' ', activeServer: null }))
      .toEqual({ apiUrl: undefined, serverProfiles: undefined, activeServer: undefined })
  })

  it('serializes profile objects from hand-written static configuration', () => {
    expect(readRuntimeConfiguration({
      serverProfiles: { servers: [{ name: 'Local', url: '/api' }] },
    }).serverProfiles).toBe('{"servers":[{"name":"Local","url":"/api"}]}')
  })
})
