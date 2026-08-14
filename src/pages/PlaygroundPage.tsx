import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Clipboard,
  Clock3,
  Code2,
  Layers3,
  Play,
  RotateCcw,
  ShieldCheck,
  ShieldX,
} from 'lucide-react'
import type { AuthorizeRequest, AuthorizeResponse } from '../api/client'
import { useWorkspace } from '../app/workspace'
import { EmptyState } from '../components/EmptyState'
import { PolicyViewer } from '../components/PolicyViewer'
import { SchemaFields } from '../components/SchemaFields'
import {
  buildAuthorizeRequest,
  emptyForm,
  getAction,
  initializeFormForAction,
  splitAlternatives,
  type WorkbenchForm,
} from '../domain/request'
import { derivedAttributesFor } from '../domain/labels'
import { inferGroupSuggestionsFromPolicies, inferSchemaFromPolicies } from '../domain/policyInference'
import { localEntityName } from '../domain/schema'

type SavedRun = {
  at: string
  duration: number
  request: AuthorizeRequest
  response: AuthorizeResponse
}

function savedForm(): WorkbenchForm {
  try {
    return { ...emptyForm, ...JSON.parse(localStorage.getItem('treetop.playground') ?? '{}') }
  } catch {
    return emptyForm
  }
}

function requestTemplate(): AuthorizeRequest {
  return {
    requests: [
      {
        id: 'check-1',
        principal: { User: { id: 'alice', namespace: [], groups: [] } },
        action: { id: 'view', namespace: [] },
        resource: { kind: 'Document', id: 'document-1' },
      },
    ],
  }
}

function groupSuggestionValue(type: string, id: string, principalType: string) {
  const groupNamespace = type.split('::').slice(0, -1)
  const principalNamespace = principalType.split('::').slice(0, -1)
  return groupNamespace.join('::') === principalNamespace.join('::')
    ? id
    : `${type}::${JSON.stringify(id)}`
}

export function PlaygroundPage() {
  const { schemaModel, status, client, loading } = useWorkspace()
  const [form, setForm] = useState<WorkbenchForm>(savedForm)
  const [mode, setMode] = useState<'form' | 'json'>('form')
  const [detail, setDetail] = useState<'brief' | 'full'>('full')
  const [raw, setRaw] = useState(() => JSON.stringify(requestTemplate(), null, 2))
  const [running, setRunning] = useState(false)
  const [response, setResponse] = useState<AuthorizeResponse>()
  const [duration, setDuration] = useState<number>()
  const [runError, setRunError] = useState<string>()
  const [copied, setCopied] = useState(false)
  const runSequence = useRef(0)
  const policiesMetadata = status?.policy_configuration.policies
  const inferredSchemaModel = useMemo(
    () => schemaModel ? undefined : inferSchemaFromPolicies(policiesMetadata?.content ?? ''),
    [schemaModel, policiesMetadata],
  )
  const inferredGroupsByAction = useMemo(
    () => schemaModel ? {} : inferGroupSuggestionsFromPolicies(policiesMetadata?.content ?? ''),
    [schemaModel, policiesMetadata],
  )
  const model = schemaModel ?? inferredSchemaModel
  const usingInferredSchema = !schemaModel && Boolean(inferredSchemaModel)

  useEffect(() => {
    runSequence.current += 1
    setRunning(false)
    setResponse(undefined)
    setDuration(undefined)
    setRunError(undefined)
  }, [client])

  useEffect(() => {
    if (!model) return
    const invocable = model.actions.filter((action) => action.invocable)
    const action = invocable.find(({ key }) => key === form.actionKey) ?? invocable[0]
    if (action && action.key !== form.actionKey) {
      setForm((current) => initializeFormForAction(model, action, current))
    }
  }, [model, form.actionKey])

  useEffect(() => {
    try {
      localStorage.setItem('treetop.playground', JSON.stringify(form))
    } catch {
      // Last-used values are a convenience only.
    }
  }, [form])

  const action = model ? getAction(model, form) : undefined
  const groupSuggestions = (inferredGroupsByAction[form.actionKey] ?? []).map((group) => ({
    label: group.id,
    value: groupSuggestionValue(group.type, group.id, form.principalType),
  }))
  const resourceEntity = model?.entityByKey.get(form.resourceType)
  const labelsContent = status?.policy_configuration.labels.content
  const derivedResourceAttributes = useMemo(
    () => derivedAttributesFor(labelsContent, form.resourceType),
    [labelsContent, form.resourceType],
  )
  const built = useMemo(() => {
    if (!model) return { body: undefined, error: undefined }
    try {
      return { body: buildAuthorizeRequest(model, form, derivedResourceAttributes), error: undefined }
    } catch (cause) {
      return { body: undefined, error: cause instanceof Error ? cause.message : String(cause) }
    }
  }, [model, form, derivedResourceAttributes])

  useEffect(() => {
    if (mode === 'form' && built.body) setRaw(JSON.stringify(built.body, null, 2))
  }, [built.body, mode])

  const batchCount = built.body?.requests.length ??
    splitAlternatives(form.principalIds, form.matrix).length * splitAlternatives(form.resourceIds, form.matrix).length
  const maxBatch = status?.request_limits?.max_batch_size

  async function run() {
    const sequence = ++runSequence.current
    setRunError(undefined)
    setResponse(undefined)
    let body: AuthorizeRequest
    try {
      body = mode === 'json' ? (JSON.parse(raw) as AuthorizeRequest) : (() => {
        if (!built.body) throw new Error(built.error ?? 'The request is incomplete')
        return built.body
      })()
      if (!Array.isArray(body.requests) || body.requests.length === 0) throw new Error('The request must contain at least one check')
      if (maxBatch && body.requests.length > maxBatch) throw new Error(`Batch contains ${body.requests.length} checks; the server limit is ${maxBatch}`)
    } catch (cause) {
      setRunError(cause instanceof Error ? cause.message : String(cause))
      return
    }

    setRunning(true)
    const started = performance.now()
    try {
      const result = await client.authorize(body, detail)
      if (sequence !== runSequence.current) return
      const elapsed = performance.now() - started
      setDuration(elapsed)
      setResponse(result)
      const saved: SavedRun = { at: new Date().toISOString(), duration: elapsed, request: body, response: result }
      try {
        const history = JSON.parse(localStorage.getItem('treetop.history') ?? '[]') as SavedRun[]
        localStorage.setItem('treetop.history', JSON.stringify([saved, ...history].slice(0, 20)))
      } catch {
        // History is intentionally best-effort.
      }
    } catch (cause) {
      if (sequence === runSequence.current) {
        setRunError(cause instanceof Error ? cause.message : String(cause))
      }
    } finally {
      if (sequence === runSequence.current) setRunning(false)
    }
  }

  function selectAction(key: string) {
    const selected = model?.actions.find((entry) => entry.key === key)
    if (model && selected) setForm((current) => initializeFormForAction(model, selected, current))
  }

  function selectResource(key: string) {
    const shape = model?.entityByKey.get(key)?.shape
    const derived = new Set(['id', ...derivedAttributesFor(labelsContent, key)])
    setForm((current) => ({
      ...current,
      resourceType: key,
      resourceIncluded: Object.fromEntries(
        Object.entries(shape?.attributes ?? {})
          .filter(([name]) => !derived.has(name))
          .map(([name, type]) => [name, type.required !== false]),
      ),
    }))
  }

  function addGroup(group: string) {
    setForm((current) => {
      const groups = current.groups.split(',').map((value) => value.trim()).filter(Boolean)
      if (groups.includes(group)) return current
      return { ...current, groups: [...groups, group].join(', ') }
    })
  }

  if (!model && !loading && mode === 'form') {
    return (
      <EmptyState icon={<Code2 size={27} />} title="No Cedar schema is loaded">
        <p>The guided form needs a schema. You can still send a complete REST request in JSON mode.</p>
        <button className="button primary" onClick={() => setMode('json')}>Open JSON request</button>
      </EmptyState>
    )
  }

  return (
    <div className="playground-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">Authorization laboratory</div>
          <h2>Ask the policy engine</h2>
          <p>{usingInferredSchema
            ? 'Build a request from the principal, action, and resource types found in the active policies.'
            : 'Build a valid request from the active Cedar schema, then inspect the exact decision.'}</p>
        </div>
        <div className="segmented" aria-label="Request editor mode">
          <button className={mode === 'form' ? 'active' : ''} onClick={() => setMode('form')}>Guided</button>
          <button className={mode === 'json' ? 'active' : ''} onClick={() => {
            if (built.body) setRaw(JSON.stringify(built.body, null, 2))
            setMode('json')
          }}>JSON</button>
        </div>
      </div>

      <div className="workbench-grid">
        <section className="panel request-panel">
          <div className="panel-heading">
            <div><span className="step-number">01</span><div><h3>Request</h3><p>{mode === 'form' ? (usingInferredSchema ? 'Policy-inferred inputs' : 'Schema-guided inputs') : 'REST payload'}</p></div></div>
            <button className={`matrix-toggle ${form.matrix ? 'active' : ''}`} onClick={() => setForm((value) => ({ ...value, matrix: !value.matrix }))} disabled={mode === 'json'}>
              <Layers3 size={15} /> Matrix
            </button>
          </div>

          {mode === 'json' ? (
            <div className="json-editor-wrap">
              <textarea aria-label="Authorization request JSON" className="json-editor" value={raw} onChange={(event) => setRaw(event.target.value)} spellCheck={false} />
              <button className="copy-button" onClick={async () => {
                await navigator.clipboard.writeText(raw)
                setCopied(true)
                window.setTimeout(() => setCopied(false), 1200)
              }}>{copied ? <Check size={14} /> : <Clipboard size={14} />}{copied ? 'Copied' : 'Copy'}</button>
            </div>
          ) : (
            <div className="request-form">
              {usingInferredSchema && (
                <div className="inference-notice">
                  <AlertTriangle size={16} />
                  <div><strong>No schema loaded—choices are inferred from policy scopes.</strong><span>Resource attributes and context cannot be determined reliably; use JSON mode when a policy requires them.</span></div>
                </div>
              )}
              <div className="form-section action-section">
                <label className="field-label" htmlFor="action">Action</label>
                <div className="select-wrap">
                  <select id="action" value={form.actionKey} onChange={(event) => selectAction(event.target.value)}>
                    {(model?.actions ?? []).filter(({ invocable }) => invocable).map((entry) => (
                      <option key={entry.key} value={entry.key}>{entry.key}</option>
                    ))}
                  </select>
                  <ChevronDown size={15} />
                </div>
                {action?.annotations.doc && <p className="field-help">{action.annotations.doc}</p>}
              </div>

              <div className="form-section split-section">
                <div className="section-label"><span className="step-number small">A</span> Principal</div>
                <div className="field-row two">
                  <div>
                    <label className="field-label" htmlFor="principal-type">Type</label>
                    <select id="principal-type" value={form.principalType} onChange={(event) => setForm((value) => ({ ...value, principalType: event.target.value }))}>
                      {(action?.principalTypes ?? []).map((type) => <option value={type} key={type}>{type}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="field-label" htmlFor="principal-id">ID {form.matrix && <span>use | for alternatives</span>}</label>
                    <input id="principal-id" value={form.principalIds} onChange={(event) => setForm((value) => ({ ...value, principalIds: event.target.value }))} placeholder={form.matrix ? 'alice | bob' : 'alice'} />
                  </div>
                </div>
                {localEntityName(form.principalType) === 'User' && (
                  <div>
                    <label className="field-label" htmlFor="groups">Groups <span>comma-separated</span></label>
                    <input id="groups" value={form.groups} onChange={(event) => setForm((value) => ({ ...value, groups: event.target.value }))} placeholder={groupSuggestions.map(({ label }) => label).join(', ') || 'admins, editors'} />
                    {usingInferredSchema && groupSuggestions.length > 0 && (
                      <div className="input-examples policy-group-examples">
                        <span>Policy groups</span>
                        {groupSuggestions.map(({ label, value }) => <button type="button" onClick={() => addGroup(value)} key={value}>{label}</button>)}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="form-section split-section">
                <div className="section-label"><span className="step-number small">B</span> Resource</div>
                <div className="field-row two">
                  <div>
                    <label className="field-label" htmlFor="resource-type">Type</label>
                    <select id="resource-type" value={form.resourceType} onChange={(event) => selectResource(event.target.value)}>
                      {(action?.resourceTypes ?? []).map((type) => <option value={type} key={type}>{type}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="field-label" htmlFor="resource-id">ID {form.matrix && <span>use | for alternatives</span>}</label>
                    <input id="resource-id" value={form.resourceIds} onChange={(event) => setForm((value) => ({ ...value, resourceIds: event.target.value }))} placeholder={form.matrix ? 'document-1 | document-2' : 'document-1'} />
                  </div>
                </div>
                <SchemaFields
                  record={resourceEntity?.shape ?? { type: 'Record' }}
                  values={form.resourceValues}
                  included={form.resourceIncluded}
                  onValue={(name, value) => setForm((current) => ({ ...current, resourceValues: { ...current.resourceValues, [name]: value } }))}
                  onIncluded={(name, value) => setForm((current) => ({ ...current, resourceIncluded: { ...current.resourceIncluded, [name]: value } }))}
                  emptyLabel="This resource has no declared attributes."
                  exclude={['id', ...derivedResourceAttributes]}
                />
                {derivedResourceAttributes.length > 0 && (
                  <p className="field-help">Derived by server labels: {derivedResourceAttributes.join(', ')}</p>
                )}
              </div>

              <div className="form-section split-section">
                <div className="section-label"><span className="step-number small">C</span> Context <span className="section-optional">Action-specific</span></div>
                <SchemaFields
                  record={action?.context ?? { type: 'Record' }}
                  values={form.contextValues}
                  included={form.contextIncluded}
                  onValue={(name, value) => setForm((current) => ({ ...current, contextValues: { ...current.contextValues, [name]: value } }))}
                  onIncluded={(name, value) => setForm((current) => ({ ...current, contextIncluded: { ...current.contextIncluded, [name]: value } }))}
                  emptyLabel="This action declares an empty context."
                />
              </div>
            </div>
          )}

          {(runError || (mode === 'form' && built.error && form.principalIds && form.resourceIds)) && (
            <div className="inline-error"><AlertTriangle size={16} /> {runError ?? built.error}</div>
          )}
          <div className="run-bar">
            <div>
              <strong>{mode === 'json' ? 'JSON batch' : `${batchCount} check${batchCount === 1 ? '' : 's'}`}</strong>
              <span>{maxBatch ? `Server limit ${maxBatch}` : 'Server limit unavailable'}</span>
            </div>
            <label className="detail-toggle"><input type="checkbox" checked={detail === 'full'} onChange={(event) => setDetail(event.target.checked ? 'full' : 'brief')} /> Full detail</label>
            <button className="button primary run-button" onClick={() => void run()} disabled={running}>
              <Play size={16} fill="currentColor" /> {running ? 'Evaluating…' : 'Evaluate'}
            </button>
          </div>
        </section>

        <section className="panel result-panel" aria-live="polite">
          <div className="panel-heading">
            <div><span className="step-number">02</span><div><h3>Decision</h3><p>Evaluated by the active policy snapshot</p></div></div>
            {duration !== undefined && <span className="duration"><Clock3 size={14} /> {duration.toFixed(0)} ms</span>}
          </div>
          {!response ? (
            <div className="result-placeholder">
              <div className="decision-orbit"><ShieldCheck size={31} /></div>
              <h3>No decision yet</h3>
              <p>Complete the request and evaluate it against Treetop.</p>
            </div>
          ) : (
            <div className="results">
              <div className="result-summary">
                <div><strong>{response.successful}</strong><span>evaluated</span></div>
                <div><strong>{response.results.filter((item) => item.result?.decision === 'Allow').length}</strong><span>allowed</span></div>
                <div><strong>{response.results.filter((item) => item.result?.decision === 'Deny').length}</strong><span>denied</span></div>
                <div><strong>{response.failed}</strong><span>failed</span></div>
              </div>
              <div className="result-list">
                {response.results.map((item) => (
                  <article className={`result-item ${item.result?.decision?.toLowerCase() ?? 'failed'}`} key={`${item.index}-${item.id}`}>
                    <div className="decision-icon">{item.result?.decision === 'Allow' ? <ShieldCheck size={20} /> : <ShieldX size={20} />}</div>
                    <div className="result-body">
                      <div className="result-title"><strong>{item.result?.decision ?? 'Failed'}</strong><span>{item.id ?? `Request ${item.index + 1}`}</span></div>
                      {item.error && <p className="error-text">{item.error}</p>}
                      {item.result?.policy_id && <div className="policy-tags">{item.result.policy_id.split('; ').map((id) => <code key={id}>{id}</code>)}</div>}
                      {item.result?.policy?.map((policy) => (
                        <details key={policy.cedar_id} className="policy-detail">
                          <summary>{policy.annotation_id ?? policy.cedar_id}</summary>
                          <PolicyViewer cedar={policy.literal} json={policy.json} />
                        </details>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
              <div className="snapshot-line"><span>Policy snapshot</span><code>{response.version.hash.slice(0, 12)}</code><span>{new Date(response.version.loaded_at).toLocaleString()}</span></div>
            </div>
          )}
          {response && <button className="button ghost rerun" onClick={() => void run()}><RotateCcw size={15} /> Run again</button>}
        </section>
      </div>
    </div>
  )
}
