import { describe, expect, it } from 'vitest'
import { inferGroupSuggestionsFromPolicies, inferSchemaFromPolicies } from './policyInference'

describe('policy-inferred schema fallback', () => {
  it('infers the schema-free photo demo action and entity choices', () => {
    const model = inferSchemaFromPolicies(`
      permit (
        principal == User::"alice",
        action in [Action::"view", Action::"edit", Action::"delete"],
        resource == Photo::"VacationPhoto94.jpg"
      );
    `)

    expect(model?.actions.map((action) => action.key)).toEqual([
      'Action::delete',
      'Action::edit',
      'Action::view',
    ])
    expect(model?.actions[0].principalTypes).toEqual(['User'])
    expect(model?.actions[0].resourceTypes).toEqual(['Photo'])
  })

  it('infers namespaced users from group-membership scopes', () => {
    const model = inferSchemaFromPolicies(`
      @id("Docs.admins_delete")
      permit (
        principal in Docs::Group::"admins",
        action == Docs::Action::"delete",
        resource is Docs::Document
      );
    `)
    const action = model?.actions[0]

    expect(action?.key).toBe('Docs::Action::delete')
    expect(action?.principalTypes).toEqual(['Docs::User'])
    expect(action?.resourceTypes).toEqual(['Docs::Document'])
    expect(model?.namespaces).toEqual(['Docs'])
  })

  it('does not pretend it can infer a form without concrete actions', () => {
    expect(inferSchemaFromPolicies('permit (principal, action, resource);')).toBeUndefined()
  })

  it('associates group memberships with the actions scoped by each policy', () => {
    const suggestions = inferGroupSuggestionsFromPolicies(`
      permit (
        principal in Group::"family",
        action == Action::"view",
        resource is Photo
      );
      permit (
        principal in Group::"owners",
        action in [Action::"view", Action::"delete"],
        resource is Photo
      );
    `)

    expect(suggestions['Action::view']).toEqual([
      { type: 'Group', id: 'family' },
      { type: 'Group', id: 'owners' },
    ])
    expect(suggestions['Action::delete']).toEqual([{ type: 'Group', id: 'owners' }])
  })
})
