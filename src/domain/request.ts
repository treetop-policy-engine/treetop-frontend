import type { AttrValue, AuthRequest, AuthorizeRequest } from '../api/client'
import type { ActionModel, CedarSchemaModel, CedarType } from './schema'
import { localEntityName, namespaceParts } from './schema'

export type WorkbenchForm = {
  actionKey: string
  principalType: string
  principalIds: string
  groups: string
  resourceType: string
  resourceIds: string
  resourceValues: Record<string, string>
  resourceIncluded: Record<string, boolean>
  contextValues: Record<string, string>
  contextIncluded: Record<string, boolean>
  matrix: boolean
}

export const emptyForm: WorkbenchForm = {
  actionKey: '',
  principalType: '',
  principalIds: '',
  groups: '',
  resourceType: '',
  resourceIds: '',
  resourceValues: {},
  resourceIncluded: {},
  contextValues: {},
  contextIncluded: {},
  matrix: false,
}

export function splitAlternatives(value: string, matrix: boolean): string[] {
  const values = matrix ? value.split('|') : [value]
  return values.map((entry) => entry.trim()).filter(Boolean)
}

function groupIdentifier(value: string, fallbackNamespace: string[]) {
  const parts = value.split('::').map((part) => part.trim()).filter(Boolean)
  const groupIndex = parts.length - 2
  if (groupIndex >= 0 && parts[groupIndex] === 'Group') {
    return {
      id: parts.at(-1)?.replace(/^"|"$/g, '') ?? '',
      namespace: parts.slice(0, groupIndex),
    }
  }
  return { id: value.replace(/^"|"$/g, ''), namespace: fallbackNamespace }
}

function parseScalar(type: CedarType, value: string): AttrValue {
  switch (type.type) {
    case 'Boolean':
      if (!['true', 'false'].includes(value)) throw new Error(`Expected true or false, got “${value}”`)
      return { type: 'Bool', value: value === 'true' }
    case 'Long': {
      const parsed = Number(value)
      if (!Number.isSafeInteger(parsed)) throw new Error(`Expected a safe integer, got “${value}”`)
      return { type: 'Long', value: parsed }
    }
    case 'Extension':
      if (type.name === 'ipaddr' || type.name === 'ip') return { type: 'Ip', value }
      throw new Error(`Extension ${type.name ?? ''} is not supported by the REST attribute format`)
    case 'String':
      return { type: 'String', value }
    default:
      throw new Error(`Type ${type.type} is not supported by the REST attribute format`)
  }
}

export function toAttrValue(type: CedarType, value: string): AttrValue {
  if (type.type !== 'Set') return parseScalar(type, value)
  if (!type.element) throw new Error('Set is missing its element type')
  return {
    type: 'Set',
    value: value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => toAttrValue(type.element!, entry)),
  }
}

function attrsFromForm(
  type: CedarType,
  values: Record<string, string>,
  included: Record<string, boolean>,
  excluded: ReadonlySet<string> = new Set(),
) {
  const attrs: Record<string, AttrValue> = {}
  for (const [name, fieldType] of Object.entries(type.attributes ?? {})) {
    if (excluded.has(name)) continue
    const required = fieldType.required !== false
    if (!required && !included[name]) continue
    const value = values[name] ?? ''
    if (!value && fieldType.type !== 'String') {
      if (required) throw new Error(`${name} is required`)
      continue
    }
    attrs[name] = toAttrValue(fieldType, value)
  }
  return attrs
}

export function getAction(model: CedarSchemaModel, form: WorkbenchForm) {
  return model.actions.find((action) => action.key === form.actionKey)
}

export function buildAuthorizeRequest(
  model: CedarSchemaModel,
  form: WorkbenchForm,
  excludedResourceAttributes: Iterable<string> = [],
): AuthorizeRequest {
  const action = getAction(model, form)
  if (!action) throw new Error('Choose an action')
  if (!form.principalType) throw new Error('Choose a principal type')
  if (!form.resourceType) throw new Error('Choose a resource type')

  const principalIds = splitAlternatives(form.principalIds, form.matrix)
  const resourceIds = splitAlternatives(form.resourceIds, form.matrix)
  if (!principalIds.length) throw new Error('Enter a principal ID')
  if (!resourceIds.length) throw new Error('Enter a resource ID')

  const principalKind = localEntityName(form.principalType)
  if (principalKind !== 'User' && principalKind !== 'Group') {
    throw new Error(`treetop-rest currently accepts User or Group principals, not ${principalKind}`)
  }

  const principalNamespace = form.principalType.split('::').slice(0, -1)
  const groups = form.groups
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => groupIdentifier(id, principalNamespace))
  const entity = model.entityByKey.get(form.resourceType)
  // treetop-core derives this attribute from resource.id before Cedar schema
  // validation; sending a second user-entered value would be misleading.
  const attrs = attrsFromForm(
    entity?.shape ?? { type: 'Record' },
    form.resourceValues,
    form.resourceIncluded,
    new Set(['id', ...excludedResourceAttributes]),
  )
  const context = attrsFromForm(action.context, form.contextValues, form.contextIncluded)
  const requests: AuthRequest[] = []

  for (const principalId of principalIds) {
    for (const resourceId of resourceIds) {
      const principal =
        principalKind === 'Group'
          ? { Group: { id: principalId, namespace: principalNamespace } }
          : { User: { id: principalId, namespace: principalNamespace, groups } }
      requests.push({
        id: `${principalId}:${action.id}:${resourceId}`,
        principal,
        action: { id: action.id, namespace: namespaceParts(action.namespace) },
        resource: {
          kind: form.resourceType,
          id: resourceId,
          ...(Object.keys(attrs).length ? { attrs } : {}),
        },
        ...(Object.keys(context).length ? { context } : {}),
      })
    }
  }

  return { requests }
}

export function initializeFormForAction(
  model: CedarSchemaModel,
  action: ActionModel,
  previous: WorkbenchForm,
  excludedResourceAttributes: Iterable<string> = [],
): WorkbenchForm {
  const principalType = action.principalTypes.includes(previous.principalType)
    ? previous.principalType
    : action.principalTypes[0] ?? ''
  const resourceType = action.resourceTypes.includes(previous.resourceType)
    ? previous.resourceType
    : action.resourceTypes[0] ?? ''
  const entity = model.entityByKey.get(resourceType)
  const excluded = new Set(['id', ...excludedResourceAttributes])

  return {
    ...previous,
    actionKey: action.key,
    principalType,
    resourceType,
    resourceIncluded: Object.fromEntries(
      Object.entries(entity?.shape.attributes ?? {})
        .filter(([name]) => !excluded.has(name))
        .map(([name, type]) => [name, type.required !== false]),
    ),
    contextIncluded: Object.fromEntries(
      Object.entries(action.context.attributes ?? {}).map(([name, type]) => [name, type.required !== false]),
    ),
  }
}
