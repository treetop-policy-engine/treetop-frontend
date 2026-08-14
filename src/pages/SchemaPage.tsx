import { useEffect, useMemo, useState } from 'react'
import { Box, Braces, Network, Search, Workflow } from 'lucide-react'
import { useWorkspace } from '../app/workspace'
import { EmptyState } from '../components/EmptyState'
import { displayNamespace, typeLabel } from '../domain/schema'

export function SchemaPage() {
  const { schemaModel, schema, loading } = useWorkspace()
  const [kind, setKind] = useState<'actions' | 'entities' | 'raw'>('actions')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState('')

  const items = useMemo(() => {
    if (!schemaModel) return []
    const values = kind === 'actions' ? schemaModel.actions : schemaModel.entities
    return values.filter(({ key }) => key.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  }, [schemaModel, kind, query])

  useEffect(() => {
    if (kind === 'raw') return
    if (!items.some(({ key }) => key === selected)) setSelected(items[0]?.key ?? '')
  }, [items, kind, selected])

  if (!schemaModel && !loading) {
    return <EmptyState icon={<Braces size={27} />} title="No schema to explore"><p>Load a Cedar JSON schema in Treetop, then refresh the workbench.</p></EmptyState>
  }

  const action = kind === 'actions' ? schemaModel?.actions.find(({ key }) => key === selected) : undefined
  const entity = kind === 'entities' ? schemaModel?.entityByKey.get(selected) : undefined

  return (
    <div>
      <div className="page-heading">
        <div><div className="eyebrow">Cedar application model</div><h2>Schema explorer</h2><p>Follow actions to compatible principals, resources, and request context.</p></div>
        <div className="segmented">
          <button className={kind === 'actions' ? 'active' : ''} onClick={() => setKind('actions')}>Actions</button>
          <button className={kind === 'entities' ? 'active' : ''} onClick={() => setKind('entities')}>Entities</button>
          <button className={kind === 'raw' ? 'active' : ''} onClick={() => setKind('raw')}>JSON</button>
        </div>
      </div>

      <div className="metadata-strip schema-summary">
        <div><span>Namespaces</span><strong>{schemaModel?.namespaces.length ?? 0}</strong></div>
        <div><span>Actions</span><strong>{schemaModel?.actions.length ?? 0}</strong></div>
        <div><span>Entities</span><strong>{schemaModel?.entities.length ?? 0}</strong></div>
        <div><span>Schema hash</span><code>{schema?.schema.sha256.slice(0, 16)}…</code></div>
      </div>

      {kind === 'raw' ? (
        <section className="panel code-panel"><pre className="raw-schema">{schema?.schema.content ? JSON.stringify(JSON.parse(schema.schema.content), null, 2) : ''}</pre></section>
      ) : (
        <div className="explorer-layout">
          <section className="panel explorer-index">
            <div className="search-box"><Search size={15} /><input aria-label={`Search ${kind}`} placeholder={`Filter ${kind}…`} value={query} onChange={(event) => setQuery(event.target.value)} /></div>
            <div className="index-list">
              {items.map((item) => (
                <button className={selected === item.key ? 'active' : ''} key={item.key} onClick={() => setSelected(item.key)}>
                  {kind === 'actions' ? <Workflow size={16} /> : <Box size={16} />}
                  <span><strong>{'id' in item ? item.id : item.name}</strong><small>{displayNamespace(item.namespace)}</small></span>
                  {'invocable' in item && !item.invocable && <em>group</em>}
                </button>
              ))}
            </div>
          </section>

          <section className="panel explorer-detail">
            {action && (
              <>
                <div className="detail-title"><div className="detail-icon"><Workflow size={22} /></div><div><span>Action</span><h3>{action.id}</h3><code>{action.key}</code></div></div>
                {action.annotations.doc && <p className="detail-doc">{action.annotations.doc}</p>}
                {!action.invocable && <div className="banner warning-banner"><strong>Action group</strong><span>Empty applicability makes this action unavailable in authorization requests.</span></div>}
                <div className="applies-grid">
                  <div><span>Principal types</span>{action.principalTypes.length ? action.principalTypes.map((value) => <code key={value}>{value}</code>) : <em>None</em>}</div>
                  <div><span>Resource types</span>{action.resourceTypes.length ? action.resourceTypes.map((value) => <code key={value}>{value}</code>) : <em>None</em>}</div>
                </div>
                <div className="detail-section"><h4><Braces size={16} /> Request context</h4><FieldTable fields={action.context.attributes ?? {}} /></div>
                {action.memberOf.length > 0 && <div className="detail-section"><h4><Network size={16} /> Member of</h4><div className="policy-tags">{action.memberOf.map((value) => <code key={value}>{value}</code>)}</div></div>}
              </>
            )}
            {entity && (
              <>
                <div className="detail-title"><div className="detail-icon"><Box size={22} /></div><div><span>Entity type</span><h3>{entity.name}</h3><code>{entity.key}</code></div></div>
                {entity.annotations.doc && <p className="detail-doc">{entity.annotations.doc}</p>}
                {entity.enum && <div className="detail-section"><h4>Allowed entity IDs</h4><div className="policy-tags">{entity.enum.map((value) => <code key={value}>{value}</code>)}</div></div>}
                <div className="detail-section"><h4><Braces size={16} /> Attributes</h4><FieldTable fields={entity.shape.attributes ?? {}} /></div>
                {entity.memberOfTypes.length > 0 && <div className="detail-section"><h4><Network size={16} /> May be member of</h4><div className="policy-tags">{entity.memberOfTypes.map((value) => <code key={value}>{value}</code>)}</div></div>}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function FieldTable({ fields }: { fields: Record<string, import('../domain/schema').CedarType> }) {
  const entries = Object.entries(fields)
  if (!entries.length) return <p className="field-empty">Empty record</p>
  return (
    <div className="field-table">
      {entries.map(([name, type]) => (
        <div key={name}><code>{name}</code><span>{typeLabel(type)}</span><em>{type.required === false ? 'optional' : 'required'}</em></div>
      ))}
    </div>
  )
}

