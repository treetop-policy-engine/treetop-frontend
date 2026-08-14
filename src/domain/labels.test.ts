import { describe, expect, it } from 'vitest'
import { derivedAttributesFor } from './labels'

describe('label-derived resource attributes', () => {
  it('finds exact resource-kind outputs without duplicating them', () => {
    const labels = JSON.stringify([
      { kind: 'DNS::Host', output: 'nameLabels' },
      { kind: 'Host', output: 'legacyLabels' },
      { kind: 'DNS::Host', output: 'nameLabels' },
      { kind: 'DNS::IPAddress', output: 'networkLabels' },
    ])
    expect(derivedAttributesFor(labels, 'DNS::Host')).toEqual(['nameLabels'])
  })

  it('treats malformed or empty metadata as no derived fields', () => {
    expect(derivedAttributesFor('{', 'Host')).toEqual([])
    expect(derivedAttributesFor(undefined, 'Host')).toEqual([])
  })
})
