import { cedarPolicySegments } from './cedarPolicy'
import type { ActionModel, CedarSchemaModel, EntityModel } from './schema'

type EntityReference = {
  type: string
  id: string
}

type InferredAction = {
  key: string
  id: string
  namespace: string
  principalTypes: Set<string>
  resourceTypes: Set<string>
}

export type InferredGroupSuggestion = {
  type: string
  id: string
}

function unescapeCedarString(value: string) {
  try {
    return JSON.parse(`"${value}"`) as string
  } catch {
    return value
  }
}

function entityReferences(source: string): EntityReference[] {
  const pattern = /((?:[A-Za-z_][A-Za-z0-9_]*::)*[A-Za-z_][A-Za-z0-9_]*)::"((?:\\.|[^"\\])*)"/g
  return [...source.matchAll(pattern)].map((match) => ({
    type: match[1],
    id: unescapeCedarString(match[2]),
  }))
}

function isTypes(source: string) {
  const pattern = /\bis\s+((?:[A-Za-z_][A-Za-z0-9_]*::)*[A-Za-z_][A-Za-z0-9_]*)\b/g
  return [...source.matchAll(pattern)].map((match) => match[1])
}

function localName(value: string) {
  return value.split('::').at(-1) ?? value
}

function namespaceOf(value: string) {
  return value.split('::').slice(0, -1).join('::')
}

function qualify(namespace: string, name: string) {
  return namespace ? `${namespace}::${name}` : name
}

function policyScope(source: string): [string, string, string] | undefined {
  const header = /\b(?:permit|forbid)\s*\(/g.exec(source)
  if (!header) return undefined
  const opening = source.indexOf('(', header.index)
  const fields: string[] = []
  let start = opening + 1
  let parentheses = 1
  let braces = 0
  let brackets = 0
  let state: 'code' | 'string' | 'line-comment' | 'block-comment' = 'code'

  for (let index = opening + 1; index < source.length; index += 1) {
    const character = source[index]
    const next = source[index + 1]
    if (state === 'line-comment') {
      if (character === '\n') state = 'code'
      continue
    }
    if (state === 'block-comment') {
      if (character === '*' && next === '/') {
        state = 'code'
        index += 1
      }
      continue
    }
    if (state === 'string') {
      if (character === '\\') index += 1
      else if (character === '"') state = 'code'
      continue
    }
    if (character === '/' && next === '/') {
      state = 'line-comment'
      index += 1
    } else if (character === '/' && next === '*') {
      state = 'block-comment'
      index += 1
    } else if (character === '"') state = 'string'
    else if (character === '(') parentheses += 1
    else if (character === ')') {
      parentheses -= 1
      if (parentheses === 0) {
        fields.push(source.slice(start, index).trim())
        break
      }
    } else if (character === '{') braces += 1
    else if (character === '}') braces -= 1
    else if (character === '[') brackets += 1
    else if (character === ']') brackets -= 1
    else if (character === ',' && parentheses === 1 && braces === 0 && brackets === 0) {
      fields.push(source.slice(start, index).trim())
      start = index + 1
    }
  }

  return fields.length === 3 ? [fields[0], fields[1], fields[2]] : undefined
}

function inferredPrincipalTypes(scope: string) {
  const types = new Set<string>()
  for (const type of isTypes(scope)) {
    if (localName(type) === 'User' || localName(type) === 'Group') types.add(type)
  }
  for (const reference of entityReferences(scope)) {
    if (localName(reference.type) === 'User') types.add(reference.type)
    if (localName(reference.type) === 'Group') {
      types.add(/\bin\b/.test(scope) ? qualify(namespaceOf(reference.type), 'User') : reference.type)
    }
  }
  return types
}

function inferredResourceTypes(scope: string) {
  return new Set([
    ...isTypes(scope),
    ...entityReferences(scope).map((reference) => reference.type),
  ])
}

function entityModel(key: string): EntityModel {
  return {
    key,
    name: localName(key),
    namespace: namespaceOf(key),
    memberOfTypes: [],
    shape: { type: 'Record', attributes: {} },
    annotations: {},
  }
}

export function inferGroupSuggestionsFromPolicies(source: string): Record<string, InferredGroupSuggestion[]> {
  const suggestions = new Map<string, Map<string, InferredGroupSuggestion>>()

  for (const policy of cedarPolicySegments(source)) {
    const scope = policyScope(policy.source)
    if (!scope) continue
    const [principalScope, actionScope] = scope
    if (!/\bin\b/.test(principalScope)) continue
    const groups = entityReferences(principalScope)
      .filter((reference) => localName(reference.type) === 'Group')
    const actions = entityReferences(actionScope)
      .filter((reference) => localName(reference.type) === 'Action')

    for (const action of actions) {
      const actionKey = qualify(action.type, action.id)
      const actionSuggestions = suggestions.get(actionKey) ?? new Map<string, InferredGroupSuggestion>()
      for (const group of groups) {
        actionSuggestions.set(`${group.type}\u0000${group.id}`, group)
      }
      suggestions.set(actionKey, actionSuggestions)
    }
  }

  return Object.fromEntries(
    [...suggestions.entries()].map(([action, groups]) => [
      action,
      [...groups.values()].sort((left, right) => left.id.localeCompare(right.id)),
    ]),
  )
}

export function inferSchemaFromPolicies(source: string): CedarSchemaModel | undefined {
  const actions = new Map<string, InferredAction>()
  const globalPrincipalTypes = new Set<string>()
  const globalResourceTypes = new Set<string>()

  for (const policy of cedarPolicySegments(source)) {
    const scope = policyScope(policy.source)
    if (!scope) continue
    const [principalScope, actionScope, resourceScope] = scope
    const principalTypes = inferredPrincipalTypes(principalScope)
    const resourceTypes = inferredResourceTypes(resourceScope)
    principalTypes.forEach((type) => globalPrincipalTypes.add(type))
    resourceTypes.forEach((type) => globalResourceTypes.add(type))

    const actionReferences = entityReferences(actionScope)
      .filter((reference) => localName(reference.type) === 'Action')
    for (const reference of actionReferences) {
      const namespace = namespaceOf(reference.type)
      const key = qualify(reference.type, reference.id)
      const action = actions.get(key) ?? {
        key,
        id: reference.id,
        namespace,
        principalTypes: new Set<string>(),
        resourceTypes: new Set<string>(),
      }
      principalTypes.forEach((type) => action.principalTypes.add(type))
      resourceTypes.forEach((type) => action.resourceTypes.add(type))
      actions.set(key, action)
    }
  }

  if (!actions.size) return undefined
  if (!globalPrincipalTypes.size) globalPrincipalTypes.add('User')
  if (!globalResourceTypes.size) globalResourceTypes.add('Resource')

  const actionModels: ActionModel[] = [...actions.values()].map((action) => ({
    key: action.key,
    id: action.id,
    namespace: action.namespace,
    principalTypes: [...(action.principalTypes.size ? action.principalTypes : globalPrincipalTypes)].sort(),
    resourceTypes: [...(action.resourceTypes.size ? action.resourceTypes : globalResourceTypes)].sort(),
    context: { type: 'Record', attributes: {} },
    memberOf: [],
    annotations: {},
    invocable: true,
  })).sort((left, right) => left.key.localeCompare(right.key))
  const entityKeys = new Set<string>()
  for (const action of actionModels) {
    action.principalTypes.forEach((type) => entityKeys.add(type))
    action.resourceTypes.forEach((type) => entityKeys.add(type))
  }
  const entities = [...entityKeys].map(entityModel).sort((left, right) => left.key.localeCompare(right.key))

  return {
    raw: {},
    namespaces: [...new Set([
      ...entities.map((entity) => entity.namespace),
      ...actionModels.map((action) => action.namespace),
    ].filter(Boolean))].sort(),
    entities,
    entityByKey: new Map(entities.map((entity) => [entity.key, entity])),
    actions: actionModels,
  }
}
