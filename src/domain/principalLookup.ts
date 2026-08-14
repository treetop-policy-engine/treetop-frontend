import type { CedarSchemaModel } from './schema'

export type PrincipalLookup = {
  user: string
  namespaces: string[]
  groups: string[]
}

export type PrincipalSuggestions = {
  userIds: string[]
  namespaces: string[]
  principalTypes: string[]
  groupIds: string[]
}

function cedarParts(value: string): string[] {
  return value
    .trim()
    .split('::')
    .map((part) => part.trim().replace(/^"|"$/g, ''))
    .filter(Boolean)
}

function namespaceParts(value: string): string[] {
  return cedarParts(value).filter((part) => part !== 'User' && part !== 'Group')
}

export function normalizePrincipalLookup(
  userInput: string,
  namespaceInput: string,
  groupsInput: string,
): PrincipalLookup {
  const principal = cedarParts(userInput)
  const user = principal.at(-1) ?? ''
  const namespaces = principal.length > 1
    ? namespaceParts(principal.slice(0, -1).join('::'))
    : namespaceParts(namespaceInput)
  const groups = groupsInput
    .split(',')
    .map((group) => cedarParts(group).at(-1) ?? '')
    .filter(Boolean)

  return { user, namespaces, groups: [...new Set(groups)] }
}

function unescapeCedarString(value: string) {
  try {
    return JSON.parse(`"${value}"`) as string
  } catch {
    return value
  }
}

function policyEntities(content: string, kind: 'User' | 'Group') {
  const pattern = new RegExp(
    `(?:([A-Za-z_][A-Za-z0-9_]*(?:::[A-Za-z_][A-Za-z0-9_]*)*)::)?${kind}::"((?:\\\\.|[^"\\\\])*)"`,
    'g',
  )
  const matches: Array<{ namespace: string; id: string }> = []
  for (const match of content.matchAll(pattern)) {
    matches.push({ namespace: match[1] ?? '', id: unescapeCedarString(match[2]) })
  }
  return matches
}

export function principalSuggestions(
  model: CedarSchemaModel | undefined,
  policyContent: string | undefined,
): PrincipalSuggestions {
  const users = policyEntities(policyContent ?? '', 'User')
  const groups = policyEntities(policyContent ?? '', 'Group')
  const principalTypes = (model?.entities ?? [])
    .filter(({ name }) => name === 'User')
    .map(({ key }) => key)
  const policyNamespaces = [...users, ...groups].map(({ namespace }) => namespace)
  const namespaces = [
    ...(model?.entities ?? []).filter(({ name }) => name === 'User').map(({ namespace }) => namespace),
    ...policyNamespaces,
  ].filter(Boolean)
  const inferredPrincipalTypes = policyNamespaces.map((namespace) => namespace ? `${namespace}::User` : 'User')

  return {
    userIds: [...new Set(users.map(({ id }) => id))].sort(),
    namespaces: [...new Set(namespaces)].sort(),
    principalTypes: [...new Set([...principalTypes, ...inferredPrincipalTypes])].sort(),
    groupIds: [...new Set(groups.map(({ id }) => id))].sort(),
  }
}
