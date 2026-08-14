export type CedarType = {
  type: string
  name?: string
  required?: boolean
  element?: CedarType
  attributes?: Record<string, CedarType>
  additionalAttributes?: boolean
  annotations?: Record<string, string>
}

type CedarNamespace = {
  entityTypes?: Record<
    string,
    {
      memberOfTypes?: string[]
      shape?: CedarType
      enum?: string[]
      annotations?: Record<string, string>
    }
  >
  actions?: Record<
    string,
    {
      memberOf?: Array<string | { id: string; type?: string }>
      appliesTo?: {
        principalTypes?: string[]
        resourceTypes?: string[]
        context?: CedarType
      }
      annotations?: Record<string, string>
    }
  >
  commonTypes?: Record<string, CedarType>
  annotations?: Record<string, string>
}

export type EntityModel = {
  key: string
  name: string
  namespace: string
  memberOfTypes: string[]
  shape: CedarType
  annotations: Record<string, string>
  enum?: string[]
}

export type ActionModel = {
  key: string
  id: string
  namespace: string
  principalTypes: string[]
  resourceTypes: string[]
  context: CedarType
  memberOf: string[]
  annotations: Record<string, string>
  invocable: boolean
}

export type CedarSchemaModel = {
  raw: Record<string, CedarNamespace>
  namespaces: string[]
  entities: EntityModel[]
  entityByKey: Map<string, EntityModel>
  actions: ActionModel[]
}

const builtins = new Set(['String', 'Boolean', 'Long', 'Record', 'Set', 'Entity', 'Extension'])

function qualify(namespace: string, name: string) {
  if (name.includes('::') || !namespace) return name
  return `${namespace}::${name}`
}

function commonType(
  raw: Record<string, CedarNamespace>,
  namespace: string,
  name: string,
): { namespace: string; value: CedarType } | undefined {
  if (name.includes('::')) {
    const parts = name.split('::')
    const localName = parts.pop()!
    const owner = parts.join('::')
    const value = raw[owner]?.commonTypes?.[localName]
    return value ? { namespace: owner, value } : undefined
  }
  const value = raw[namespace]?.commonTypes?.[name]
  return value ? { namespace, value } : undefined
}

function resolveType(
  raw: Record<string, CedarNamespace>,
  namespace: string,
  input: CedarType | undefined,
  seen = new Set<string>(),
): CedarType {
  if (!input) return { type: 'Record', attributes: {} }
  const ref = !builtins.has(input.type) ? commonType(raw, namespace, input.type) : undefined
  if (ref) {
    const marker = `${ref.namespace}::${input.type}`
    if (seen.has(marker)) return { ...input, type: 'UnsupportedCycle' }
    return {
      ...resolveType(raw, ref.namespace, ref.value, new Set([...seen, marker])),
      required: input.required,
      annotations: { ...ref.value.annotations, ...input.annotations },
    }
  }

  if (input.type === 'EntityOrCommon' && input.name) {
    const refByName = commonType(raw, namespace, input.name)
    if (refByName) return resolveType(raw, refByName.namespace, refByName.value, seen)
    return { ...input, type: 'Entity', name: qualify(namespace, input.name) }
  }

  if (input.type === 'Record') {
    return {
      ...input,
      attributes: Object.fromEntries(
        Object.entries(input.attributes ?? {}).map(([name, type]) => [
          name,
          resolveType(raw, namespace, type, seen),
        ]),
      ),
    }
  }

  if (input.type === 'Set') {
    return { ...input, element: resolveType(raw, namespace, input.element, seen) }
  }

  return input
}

export function parseCedarSchema(content: string): CedarSchemaModel {
  const parsed: unknown = JSON.parse(content)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Cedar schema must be a JSON object keyed by namespace')
  }

  const raw = parsed as Record<string, CedarNamespace>
  const entities: EntityModel[] = []
  const actions: ActionModel[] = []

  for (const [namespace, definition] of Object.entries(raw)) {
    for (const [name, entity] of Object.entries(definition.entityTypes ?? {})) {
      entities.push({
        key: qualify(namespace, name),
        name,
        namespace,
        memberOfTypes: (entity.memberOfTypes ?? []).map((value) => qualify(namespace, value)),
        shape: resolveType(raw, namespace, entity.shape),
        annotations: entity.annotations ?? {},
        enum: entity.enum,
      })
    }

    for (const [id, action] of Object.entries(definition.actions ?? {})) {
      const principalTypes = (action.appliesTo?.principalTypes ?? []).map((value) =>
        qualify(namespace, value),
      )
      const resourceTypes = (action.appliesTo?.resourceTypes ?? []).map((value) =>
        qualify(namespace, value),
      )
      actions.push({
        key: namespace ? `${namespace}::Action::${id}` : `Action::${id}`,
        id,
        namespace,
        principalTypes,
        resourceTypes,
        context: resolveType(raw, namespace, action.appliesTo?.context),
        memberOf: (action.memberOf ?? []).map((entry) =>
          typeof entry === 'string' ? entry : entry.id,
        ),
        annotations: action.annotations ?? {},
        invocable: principalTypes.length > 0 && resourceTypes.length > 0,
      })
    }
  }

  const entityByKey = new Map(entities.map((entity) => [entity.key, entity]))
  return {
    raw,
    namespaces: Object.keys(raw),
    entities: entities.sort((a, b) => a.key.localeCompare(b.key)),
    entityByKey,
    actions: actions.sort((a, b) => a.key.localeCompare(b.key)),
  }
}

export function displayNamespace(namespace: string) {
  return namespace || 'Global'
}

export function localEntityName(qualified: string) {
  return qualified.split('::').at(-1) ?? qualified
}

export function namespaceParts(namespace: string) {
  return namespace ? namespace.split('::') : []
}

export function typeLabel(type: CedarType): string {
  if (type.type === 'Extension') return type.name ?? 'Extension'
  if (type.type === 'Set') return `Set<${typeLabel(type.element ?? { type: 'unknown' })}>`
  if (type.type === 'Entity') return type.name ?? 'Entity'
  return type.type
}

export function isSupportedField(type: CedarType): boolean {
  if (['String', 'Boolean', 'Long'].includes(type.type)) return true
  if (type.type === 'Extension') return type.name === 'ipaddr' || type.name === 'ip'
  if (type.type === 'Set') return Boolean(type.element && isSupportedField(type.element))
  return false
}

