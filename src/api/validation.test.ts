import { describe, expect, it } from 'vitest'
import { statusResponse, versionResponse } from '../test/fixtures'
import { validateAuthorization, validateStatus, validateVersion } from './validation'
import type { AuthorizeRequest } from './client'

const request: AuthorizeRequest = { requests: [{
  id: 'one', principal: { User: { id: 'alice', namespace: [], groups: [] } }, action: { id: 'read', namespace: [] },
  resource: { kind: 'App::Document', id: 'doc' },
}] }
function batch() {
  return {
    results: [{ index: 0, id: 'one', status: 'success', result: {
      decision: 'Allow', policy_id: 'permit', version: { ...versionResponse.policies },
    } }],
    version: { ...versionResponse.policies }, successful: 1, failed: 0,
  }
}

describe('strict current API responses', () => {
  it('accepts complete metadata and a distinct schema revision', () => {
    expect(validateStatus(statusResponse)).toEqual(statusResponse)
    expect(validateVersion(versionResponse)).toEqual(versionResponse)
    expect(validateAuthorization(batch(), request, 'brief').successful).toBe(1)
  })

  it.each(['hash', 'loaded_at', 'label_set', 'generation'])('requires policy version %s', (field) => {
    const version = structuredClone(versionResponse)
    Reflect.deleteProperty(version.policies, field)
    expect(() => validateVersion(version)).toThrow()
  })

  it.each(['request_limits', 'request_context'])('rejects missing %s', (field) => {
    const status = structuredClone(statusResponse)
    Reflect.deleteProperty(status, field)
    expect(() => validateStatus(status)).toThrow()
  })

  it('rejects old label syntax before the UI receives metadata', () => {
    const status = structuredClone(statusResponse)
    status.policy_configuration.labels.content = '[{"kind":"Host","output":"labels"}]'
    expect(() => validateStatus(status)).toThrow('migrate old kind/output syntax')
  })

  it.each(['count', 'index', 'id', 'generation', 'labels', 'decision', 'permit', 'precision'])('rejects inconsistent %s', (change) => {
    const response = batch()
    if (change === 'count') response.successful = 0
    if (change === 'index') response.results[0].index = 1
    if (change === 'id') response.results[0].id = 'different'
    if (change === 'generation') response.results[0].result.version.generation++
    if (change === 'labels') response.results[0].result.version.label_set = 'different'
    if (change === 'decision') response.results[0].result.decision = 'Unknown'
    if (change === 'permit') response.results[0].result.policy_id = ''
    if (change === 'precision') response.version.generation = Number.MAX_SAFE_INTEGER + 1
    expect(() => validateAuthorization(response, request, 'brief')).toThrow()
  })

  it('rejects truncated batches and failed results carrying decisions', () => {
    const response = batch()
    response.results = []
    response.successful = 0
    expect(() => validateAuthorization(response, request, 'brief')).toThrow('one result')
    const failed = batch()
    failed.results[0].status = 'failed'
    Object.assign(failed.results[0], { error: 'failure' })
    expect(() => validateAuthorization(failed, request, 'brief')).toThrow('must not contain a decision')
  })
})
