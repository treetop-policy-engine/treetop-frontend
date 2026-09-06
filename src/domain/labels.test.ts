import { describe, expect, it } from 'vitest'
import { declaredLabelTargets, derivedAttributesFor } from './labels'

describe('declared label targets', () => {
  it('matches exact namespaces while allowing equal names on distinct resource types', () => {
    const labels = JSON.stringify([
      { target: { resource_type: 'DNS::Host', attribute: 'labels' } },
      { target: { resource_type: 'Host', attribute: 'labels' } },
      { target: { resource_type: 'Other::Host', attribute: 'labels' } },
    ])
    expect(derivedAttributesFor(labels, 'DNS::Host')).toEqual(['labels'])
    expect(derivedAttributesFor(labels, 'DNS::IPAddress')).toEqual([])
    expect(declaredLabelTargets(labels)).toHaveLength(3)
  })

  it.each([
    '{', '{}', '[{"kind":"Host","output":"labels"}]',
    '[{"target":{"resource_type":"Host","attribute":"id"}}]',
    '[{"target":{"resource_type":"Host","attribute":"labels"}},{"target":{"resource_type":"Host","attribute":"labels"}}]',
  ])('rejects invalid or old label metadata: %s', (content) => {
    expect(() => declaredLabelTargets(content)).toThrow()
  })

  it('accepts empty metadata when no labels are configured', () => {
    expect(derivedAttributesFor(undefined, 'Host')).toEqual([])
    expect(derivedAttributesFor('[]', 'Host')).toEqual([])
  })
})
