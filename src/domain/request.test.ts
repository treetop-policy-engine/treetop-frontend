import { describe, expect, it } from 'vitest'
import { cedarSchema } from '../test/fixtures'
import { buildAuthorizeRequest, emptyForm, initializeFormForAction, toAttrValue } from './request'
import { parseCedarSchema } from './schema'

describe('authorization request builder', () => {
  const model = parseCedarSchema(JSON.stringify(cedarSchema))
  const action = model.actions.find(({ id }) => id === 'read')!

  it('builds typed, schema-compatible requests', () => {
    const initialized = initializeFormForAction(model, action, emptyForm)
    const request = buildAuthorizeRequest(model, {
      ...initialized,
      principalIds: 'alice',
      groups: 'readers, staff',
      resourceIds: 'roadmap',
      resourceValues: { title: 'Roadmap', revision: '7', tags: 'internal, draft' },
      resourceIncluded: { ...initialized.resourceIncluded, tags: true },
      contextValues: { environment: 'prod' },
    })

    expect(request.requests).toHaveLength(1)
    expect(request.requests[0].resource.attrs).not.toHaveProperty('id')
    expect(request.requests[0]).toMatchObject({
      principal: { User: { id: 'alice', namespace: ['App'], groups: [{ id: 'readers', namespace: ['App'] }, { id: 'staff', namespace: ['App'] }] } },
      action: { id: 'read', namespace: ['App'] },
      resource: {
        kind: 'App::Document',
        id: 'roadmap',
        attrs: {
          title: { type: 'String', value: 'Roadmap' },
          revision: { type: 'Long', value: 7 },
          tags: { type: 'Set', value: [{ type: 'String', value: 'internal' }, { type: 'String', value: 'draft' }] },
        },
      },
      context: { environment: { type: 'String', value: 'prod' } },
    })
  })

  it('expands principal and resource matrix alternatives', () => {
    const initialized = initializeFormForAction(model, action, emptyForm)
    const request = buildAuthorizeRequest(model, {
      ...initialized,
      principalIds: 'alice | bob',
      resourceIds: 'one | two',
      resourceValues: { title: 'Document', revision: '1' },
      contextValues: { environment: 'prod' },
      matrix: true,
    })
    expect(request.requests).toHaveLength(4)
    expect(request.requests.map(({ id }) => id)).toContain('bob:read:two')
  })

  it('accepts qualified group suggestions without treating the type as part of the ID', () => {
    const initialized = initializeFormForAction(model, action, emptyForm)
    const request = buildAuthorizeRequest(model, {
      ...initialized,
      principalIds: 'alice',
      groups: 'App::Group::"readers", External::Group::auditors',
      resourceIds: 'roadmap',
      resourceValues: { title: 'Roadmap', revision: '1' },
      contextValues: { environment: 'prod' },
    })

    expect(request.requests[0].principal).toEqual({
      User: {
        id: 'alice',
        namespace: ['App'],
        groups: [
          { id: 'readers', namespace: ['App'] },
          { id: 'auditors', namespace: ['External'] },
        ],
      },
    })
  })

  it('rejects invalid scalar values before sending', () => {
    expect(() => toAttrValue({ type: 'Boolean' }, 'yes')).toThrow('Expected true or false')
    expect(() => toAttrValue({ type: 'Long' }, '3.14')).toThrow('safe integer')
  })
})
