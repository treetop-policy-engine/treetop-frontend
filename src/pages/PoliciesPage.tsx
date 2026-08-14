import { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpenText, Search, UserRound, X } from 'lucide-react'
import type { PoliciesDownload, UserPolicies } from '../api/client'
import { useWorkspace } from '../app/workspace'
import { EmptyState } from '../components/EmptyState'
import { PolicyViewer } from '../components/PolicyViewer'
import { cedarPolicySegments, splitCedarPolicies } from '../domain/cedarPolicy'
import { normalizePrincipalLookup, principalSuggestions } from '../domain/principalLookup'

function annotationId(policy: unknown) {
  if (!policy || typeof policy !== 'object' || !('annotations' in policy)) return undefined
  return (policy as { annotations?: { id?: string } }).annotations?.id
}

export function PoliciesPage() {
  const { client, status, schemaModel } = useWorkspace()
  const [view, setView] = useState<'source' | 'user'>('source')
  const [download, setDownload] = useState<PoliciesDownload>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [query, setQuery] = useState('')
  const [user, setUser] = useState('')
  const [groups, setGroups] = useState('')
  const [namespace, setNamespace] = useState('')
  const [userResult, setUserResult] = useState<UserPolicies>()
  const [userPolicySource, setUserPolicySource] = useState('')
  const [userLoading, setUserLoading] = useState(false)
  const [effectiveLookup, setEffectiveLookup] = useState<string>()
  const [expandedPolicies, setExpandedPolicies] = useState<Set<string>>(new Set())
  const lookupSequence = useRef(0)

  useEffect(() => {
    let active = true
    lookupSequence.current += 1
    setLoading(true)
    setDownload(undefined)
    setError(undefined)
    setUserResult(undefined)
    setUserPolicySource('')
    setUserLoading(false)
    setEffectiveLookup(undefined)
    setExpandedPolicies(new Set())
    client.policies().then((value) => {
      if (active) setDownload(value)
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : String(cause))
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [client])

  const sourceSearch = useMemo(() => {
    const content = download?.policies.content ?? ''
    const allLines = content.split('\n').map((text, index) => ({ text, line: index + 1 }))
    const needle = query.trim().toLocaleLowerCase()
    if (!needle) return { lines: allLines, policyCount: undefined }

    const policies = cedarPolicySegments(content)
      .filter((policy) => policy.source.toLocaleLowerCase().includes(needle))
    const matchingLines = new Set<number>()
    for (const policy of policies) {
      for (let line = policy.startLine; line <= policy.endLine; line += 1) matchingLines.add(line)
    }
    return {
      lines: allLines.filter(({ line }) => matchingLines.has(line)),
      policyCount: policies.length,
    }
  }, [download, query])
  const hasSourceQuery = Boolean(query.trim())

  const metadata = download?.policies ?? status?.policy_configuration.policies
  const suggestions = useMemo(
    () => principalSuggestions(schemaModel, download?.policies.content ?? metadata?.content),
    [schemaModel, download?.policies.content, metadata?.content],
  )
  const userPlaceholder = suggestions.userIds[0] ?? 'alice'
  const groupsPlaceholder = suggestions.groupIds.slice(0, 2).join(', ') || 'admins, editors'
  const principalTypes = suggestions.principalTypes.length ? suggestions.principalTypes : ['User']
  const selectedPrincipalType = namespace || principalTypes[0]
  const matchingPolicySources = useMemo(() => splitCedarPolicies(userPolicySource), [userPolicySource])
  const allPoliciesExpanded = Boolean(
    userResult?.matches.length && userResult.matches.every(({ cedar_id }) => expandedPolicies.has(cedar_id)),
  )

  async function lookup() {
    if (!user.trim()) return
    const principalType = namespace || suggestions.principalTypes[0] || 'User'
    const principal = normalizePrincipalLookup(user, principalType, groups)
    if (!principal.user) return
    const sequence = ++lookupSequence.current
    setUserLoading(true)
    setError(undefined)
    setUserResult(undefined)
    setUserPolicySource('')
    setExpandedPolicies(new Set())
    try {
      const [result, source] = await Promise.all([
        client.userPolicies(principal.user, principal.namespaces, principal.groups),
        client.userPoliciesRaw(principal.user, principal.namespaces, principal.groups),
      ])
      if (sequence !== lookupSequence.current) return
      setUserResult(result)
      setUserPolicySource(source)
      setEffectiveLookup(
        `${principal.namespaces.length ? `${principal.namespaces.join('::')}::` : ''}User::"${principal.user}"`,
      )
    } catch (cause) {
      if (sequence === lookupSequence.current) {
        setError(cause instanceof Error ? cause.message : String(cause))
      }
    } finally {
      if (sequence === lookupSequence.current) setUserLoading(false)
    }
  }

  function setPolicyExpanded(id: string, expanded: boolean) {
    setExpandedPolicies((current) => {
      const next = new Set(current)
      if (expanded) next.add(id)
      else next.delete(id)
      return next
    })
  }

  return (
    <div>
      <div className="page-heading">
        <div>
          <div className="eyebrow">Loaded policy set</div>
          <h2>Policies in effect</h2>
          <p>Inspect the Cedar source or ask which policies select a particular principal.</p>
        </div>
        <div className="segmented">
          <button className={view === 'source' ? 'active' : ''} onClick={() => setView('source')}>Source</button>
          <button className={view === 'user' ? 'active' : ''} onClick={() => setView('user')}>By principal</button>
        </div>
      </div>

      {metadata && (
        <div className="metadata-strip">
          <div><span>Entries</span><strong>{metadata.entries}</strong></div>
          <div><span>Size</span><strong>{new Intl.NumberFormat().format(metadata.size)} B</strong></div>
          <div><span>Loaded</span><strong>{new Date(metadata.timestamp).toLocaleString()}</strong></div>
          <div className="hash-cell"><span>SHA-256</span><code title={metadata.sha256}>{metadata.sha256.slice(0, 16)}…</code></div>
        </div>
      )}

      {error && <div className="banner error-banner"><strong>Request failed.</strong><span>{error}</span></div>}

      {view === 'source' ? (
        <section className="panel code-panel">
          <div className="code-toolbar">
            <div className="search-box"><Search size={16} /><input aria-label="Search policy source" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search policy IDs, actions, resources…" />{query && <button className="icon-button" onClick={() => setQuery('')}><X size={15} /></button>}</div>
            <span>{hasSourceQuery
              ? `${sourceSearch.policyCount} matching ${sourceSearch.policyCount === 1 ? 'policy' : 'policies'}`
              : `${sourceSearch.lines.length} lines`}</span>
          </div>
          {loading ? <div className="loading-block">Loading policies…</div> : !download?.policies.content ? (
            <EmptyState icon={<BookOpenText size={25} />} title="No policies loaded"><p>The server returned an empty policy set.</p></EmptyState>
          ) : hasSourceQuery && sourceSearch.policyCount === 0 ? (
            <EmptyState icon={<Search size={25} />} title="No matching policies"><p>Try a policy ID, entity, action, or resource type.</p></EmptyState>
          ) : (
            <pre className="source-viewer" aria-label="Cedar policy source">{sourceSearch.lines.map(({ text, line }) => <span className="source-line" key={line}><i>{line}</i><code>{text || ' '}</code></span>)}</pre>
          )}
        </section>
      ) : (
        <div className="lookup-layout">
          <section className="panel lookup-form">
            <div className="panel-heading"><div><UserRound size={20} /><div><h3>Principal lookup</h3><p>Find policies selected by scope</p></div></div></div>
            <label className="field-label" htmlFor="lookup-user">User ID <span>or full principal</span></label>
            <input id="lookup-user" autoComplete="off" value={user} onChange={(event) => setUser(event.target.value)} placeholder={userPlaceholder} onKeyDown={(event) => { if (event.key === 'Enter') void lookup() }} />
            {suggestions.userIds.length > 0 && <div className="input-examples"><span>Examples</span>{suggestions.userIds.slice(0, 3).map((id) => <button type="button" onClick={() => setUser(id)} key={id}>{id}</button>)}</div>}
            <label className="field-label" htmlFor="lookup-principal-type">Principal type</label>
            <select id="lookup-principal-type" value={selectedPrincipalType} onChange={(event) => setNamespace(event.target.value)}>
              {principalTypes.map((value) => <option value={value} key={value}>{value}</option>)}
            </select>
            <label className="field-label" htmlFor="lookup-groups">Groups <span>comma-separated</span></label>
            <input id="lookup-groups" autoComplete="off" value={groups} onChange={(event) => setGroups(event.target.value)} placeholder={groupsPlaceholder} />
            {suggestions.groupIds.length > 0 && <div className="input-examples"><span>Examples</span>{suggestions.groupIds.slice(0, 3).map((id) => <button type="button" onClick={() => setGroups((current) => current ? `${current}, ${id}` : id)} key={id}>{id}</button>)}</div>}
            <button className="button primary" disabled={!user.trim() || userLoading} onClick={() => void lookup()}>{userLoading ? 'Looking up…' : 'Find policies'}</button>
          </section>
          <section className="panel lookup-results" aria-live="polite">
            {!userResult ? (
              <div className="result-placeholder compact"><UserRound size={28} /><h3>No principal selected</h3><p>Enter an ID to inspect static policy matches.</p></div>
            ) : (
              <>
                <div className="lookup-title"><div><span>Principal</span><h3>{effectiveLookup ?? userResult.user}</h3></div><strong>{userResult.policies.length} policies</strong></div>
                {!userResult.matches.length ? <p className="field-empty">No permit policy scopes matched. Include the principal's groups when looking up group-based policies.</p> : (
                  <div className="matched-policies">
                    <div className="match-toolbar">
                      <span>Static scope matches; conditions are not evaluated.</span>
                      <button type="button" onClick={() => setExpandedPolicies(
                        allPoliciesExpanded ? new Set() : new Set(userResult.matches.map(({ cedar_id }) => cedar_id)),
                      )}>{allPoliciesExpanded ? 'Collapse all' : 'Expand all'}</button>
                    </div>
                    <div className="match-list">
                      {userResult.matches.map((match, index) => {
                        const policy = userResult.policies[index]
                        const displayId = annotationId(policy) ?? match.cedar_id
                        return (
                          <details
                            className="policy-match"
                            key={match.cedar_id}
                            open={expandedPolicies.has(match.cedar_id)}
                            onToggle={(event) => setPolicyExpanded(match.cedar_id, event.currentTarget.open)}
                          >
                            <summary>
                              <code title={`Internal Cedar ID: ${match.cedar_id}`}>{displayId}</code>
                              <span>{match.reasons.map((reason) => <i className="reason-tag" key={reason}>{reason}</i>)}</span>
                            </summary>
                            <PolicyViewer cedar={matchingPolicySources[index]} json={policy} />
                          </details>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
