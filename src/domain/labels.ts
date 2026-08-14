type LabelDefinition = {
  kind?: unknown
  output?: unknown
}

export function derivedAttributesFor(content: string | undefined, resourceType: string): string[] {
  if (!content?.trim() || !resourceType) return []
  try {
    const parsed: unknown = JSON.parse(content)
    if (!Array.isArray(parsed)) return []
    return [...new Set(parsed.flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return []
      const { kind, output } = entry as LabelDefinition
      if (typeof kind !== 'string' || typeof output !== 'string') return []
      return kind === resourceType ? [output] : []
    }))]
  } catch {
    return []
  }
}
