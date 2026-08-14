import { describe, expect, it } from 'vitest'
import { cedarSchema } from '../test/fixtures'
import { parseCedarSchema } from './schema'
import { normalizePrincipalLookup, principalSuggestions } from './principalLookup'

describe('principal policy lookup', () => {
  it('accepts a namespace, principal type, or fully-qualified principal', () => {
    expect(normalizePrincipalLookup('alice', 'Docs', 'editors')).toEqual({
      user: 'alice', namespaces: ['Docs'], groups: ['editors'],
    })
    expect(normalizePrincipalLookup('alice', 'Docs::User', 'Docs::Group::editors')).toEqual({
      user: 'alice', namespaces: ['Docs'], groups: ['editors'],
    })
    expect(normalizePrincipalLookup('Docs::User::"alice"', 'Ignored', '')).toEqual({
      user: 'alice', namespaces: ['Docs'], groups: [],
    })
  })

  it('derives examples from the active schema and policies', () => {
    const model = parseCedarSchema(JSON.stringify(cedarSchema))
    const suggestions = principalSuggestions(model, `
      permit (principal == App::User::"alice", action, resource);
      permit (principal in App::Group::"readers", action, resource);
      permit (principal in App::Group::"editors", action, resource);
    `)
    expect(suggestions).toEqual({
      userIds: ['alice'],
      namespaces: ['App'],
      principalTypes: ['App::User'],
      groupIds: ['editors', 'readers'],
    })
  })
})
