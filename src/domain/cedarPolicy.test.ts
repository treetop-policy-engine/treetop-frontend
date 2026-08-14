import { describe, expect, it } from 'vitest'
import { cedarPolicySegments, splitCedarPolicies } from './cedarPolicy'

describe('Cedar policy source splitting', () => {
  it('keeps annotations and conditions with each policy', () => {
    const policies = splitCedarPolicies(`
      @id("one")
      permit (principal, action, resource);

      // A semicolon in a string is not a boundary.
      @id("two")
      permit (principal, action, resource)
      when { context.note == "keep;this" };
    `)
    expect(policies).toHaveLength(2)
    expect(policies[0]).toContain('@id("one")')
    expect(policies[1]).toContain('@id("two")')
    expect(policies[1]).toContain('"keep;this"')
  })

  it('retains the original line range for complete-policy search results', () => {
    const source = `@id("one")
permit (principal, action, resource);

@id("two")
permit (
  principal,
  action == Action::"read",
  resource
);`
    const matches = cedarPolicySegments(source)
      .filter((policy) => policy.source.includes('Action::"read"'))

    expect(matches).toHaveLength(1)
    expect(matches[0]).toMatchObject({ startLine: 4, endLine: 9 })
    expect(matches[0].source).toContain('@id("two")')
    expect(matches[0].source).not.toContain('@id("one")')
  })
})
