import { declaredLabelTargets } from '../domain/labels'
import type { AuthorizeRequest, AuthorizeResponse, PolicyVersion, StatusResponse, VersionInfo } from './client'

type ObjectValue = Record<string, unknown>
function object(value: unknown, field: string): ObjectValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${field} must be an object.`)
  return value as ObjectValue
}
function string(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string.`)
}
function unsigned(value: unknown, field: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} must be a nonnegative integer representable without precision loss.`)
  }
}
function boolean(value: unknown, field: string): void {
  if (typeof value !== 'boolean') throw new Error(`${field} must be a boolean.`)
}
function revision(value: unknown, field: string): ObjectValue {
  const data = object(value, field)
  string(data.hash, `${field}.hash`)
  string(data.loaded_at, `${field}.loaded_at`)
  return data
}
function policyVersion(value: unknown): PolicyVersion {
  const data = revision(value, 'Policy version')
  if (data.label_set !== null) string(data.label_set, 'Policy version.label_set')
  unsigned(data.generation, 'Policy version.generation')
  return data as PolicyVersion
}
function metadata(value: unknown, field: string): ObjectValue {
  const data = object(value, field)
  string(data.timestamp, `${field}.timestamp`)
  string(data.sha256, `${field}.sha256`)
  string(data.content, `${field}.content`)
  unsigned(data.size, `${field}.size`)
  unsigned(data.entries, `${field}.entries`)
  if (data.source !== undefined && data.source !== null) {
    const source = object(data.source, `${field}.source`)
    string(source.url, `${field}.source.url`)
    if (Object.keys(source).some((key) => key !== 'url')) throw new Error('Metadata source requires only url.')
    const url = new URL(source.url)
    if (!url.host) throw new Error('Metadata source requires an absolute URL.')
  }
  return data
}

export function validateStatus(value: unknown): StatusResponse {
  const data = object(value, 'Status')
  const policies = object(data.policy_configuration, 'Policy configuration')
  boolean(policies.allow_upload, 'allow_upload')
  if (policies.schema_validation_mode !== 'strict' && policies.schema_validation_mode !== 'permissive') {
    throw new Error('Schema validation mode must be strict or permissive.')
  }
  metadata(policies.policies, 'Policies')
  metadata(policies.schema, 'Schema')
  const labels = metadata(policies.labels, 'Labels')
  declaredLabelTargets(labels.content as string)
  const parallel = object(data.parallel_configuration, 'Parallel configuration')
  for (const key of ['cpu_count', 'workers', 'rayon_threads', 'par_threshold']) unsigned(parallel[key], key)
  boolean(parallel.allow_parallel, 'allow_parallel')
  const limits = object(data.request_limits, 'Request limits')
  for (const key of ['max_batch_size', 'max_context_bytes', 'max_context_depth', 'max_context_keys']) unsigned(limits[key], key)
  const context = object(data.request_context, 'Request context')
  boolean(context.supported, 'Request context.supported')
  boolean(context.schema_backed, 'Request context.schema_backed')
  if (context.fallback_reason !== undefined && context.fallback_reason !== null) string(context.fallback_reason, 'fallback_reason')
  return data as StatusResponse
}

export function validateVersion(value: unknown): VersionInfo {
  const data = object(value, 'Version response')
  string(data.version, 'Server version')
  const core = object(data.core, 'Core version')
  string(core.version, 'Core version')
  string(core.cedar, 'Cedar version')
  policyVersion(data.policies)
  if (data.schema !== undefined && data.schema !== null) revision(data.schema, 'Schema version')
  return data as VersionInfo
}

export function validateAuthorization(value: unknown, request: AuthorizeRequest, detail: 'brief' | 'full'): AuthorizeResponse {
  const data = object(value, 'Authorization response')
  const version = policyVersion(data.version)
  if (!Array.isArray(data.results) || data.results.length !== request.requests.length) {
    throw new Error('Authorization response must contain one result per submitted request.')
  }
  unsigned(data.successful, 'Successful count')
  unsigned(data.failed, 'Failed count')
  let successful = 0
  data.results.forEach((value, index) => {
    const item = object(value, 'Authorization result')
    if (item.index !== index || (item.id ?? null) !== (request.requests[index].id ?? null)) {
      throw new Error('Authorization result index or ID differs from the submitted request.')
    }
    if (item.status === 'failed') {
      string(item.error, 'Failed result error')
      if ('result' in item) throw new Error('Failed authorization result must not contain a decision.')
      return
    }
    if (item.status !== 'success' || 'error' in item) throw new Error('Invalid authorization result status.')
    successful++
    const result = object(item.result, 'Authorization decision')
    const itemVersion = policyVersion(result.version)
    if (itemVersion.hash !== version.hash || itemVersion.loaded_at !== version.loaded_at
      || itemVersion.label_set !== version.label_set || itemVersion.generation !== version.generation) {
      throw new Error('Authorization result and batch versions differ.')
    }
    if (result.decision !== 'Allow' && result.decision !== 'Deny') throw new Error('Invalid authorization decision.')
    const allowed = result.decision === 'Allow'
    if (detail === 'brief') {
      string(result.policy_id, 'Policy ID')
      if (allowed !== Boolean(result.policy_id)) throw new Error('Decision and policy ID disagree.')
    } else {
      if (!Array.isArray(result.policy) || allowed !== Boolean(result.policy.length)) throw new Error('Decision and policy array disagree.')
      result.policy.forEach((value) => {
        const policy = object(value, 'Permit policy')
        string(policy.literal, 'Policy literal')
        string(policy.cedar_id, 'Cedar policy ID')
        object(policy.json, 'Policy JSON')
        if (!policy.literal || !policy.cedar_id) throw new Error('Permit policy must include a literal and Cedar ID.')
      })
    }
  })
  if (data.successful !== successful || data.failed !== data.results.length - successful) {
    throw new Error('Authorization result counts disagree.')
  }
  return data as AuthorizeResponse
}
