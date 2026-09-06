export type LabelTarget = { resource_type: string; attribute: string }

/** Read the structural contract of server-validated label metadata. Cedar and
 * matcher validation belongs to Core/Bundle, not this presentation helper. */
export function declaredLabelTargets(content: string | undefined): LabelTarget[] {
  if (!content?.trim()) return []
  const parsed: unknown = JSON.parse(content)
  if (!Array.isArray(parsed)) throw new Error('Label configuration must be an array of declared targets.')
  const seen = new Set<string>()
  return parsed.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object' || !('target' in entry) || 'kind' in entry || 'output' in entry) {
      throw new Error('Label rules require target.resource_type and target.attribute; migrate old kind/output syntax.')
    }
    const target = entry.target
    if (!target || typeof target !== 'object' || !('resource_type' in target) || !('attribute' in target)
      || typeof target.resource_type !== 'string' || !target.resource_type
      || typeof target.attribute !== 'string' || !target.attribute || target.attribute === 'id'
      || Object.keys(target).some((key) => key !== 'resource_type' && key !== 'attribute')) {
      throw new Error('Label target must declare one resource type and a non-reserved attribute.')
    }
    const key = JSON.stringify([target.resource_type, target.attribute])
    if (seen.has(key)) throw new Error('Label configuration has duplicate target ownership.')
    seen.add(key)
    return { resource_type: target.resource_type, attribute: target.attribute }
  })
}

export function derivedAttributesFor(content: string | undefined, resourceType: string): string[] {
  return declaredLabelTargets(content)
    .filter((target) => target.resource_type === resourceType)
    .map((target) => target.attribute)
}
