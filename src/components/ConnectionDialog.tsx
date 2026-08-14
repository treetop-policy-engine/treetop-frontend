import { useEffect, useState } from 'react'
import { Check, Link2, Plus, Save, Server, Trash2, X } from 'lucide-react'
import { useWorkspace } from '../app/workspace'
import type { ServerProfile } from '../app/serverProfiles'

type Props = { open: boolean; onClose: () => void }

export function ConnectionDialog({ open, onClose }: Props) {
  const {
    servers,
    activeServer,
    connect,
    saveServer,
    setAccessToken,
    clearAccessToken,
    accessTokenConfigured,
    removeServer,
    loading,
    error,
  } = useWorkspace()
  const [selectedId, setSelectedId] = useState(activeServer.id)
  const [editingId, setEditingId] = useState<string>()
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [accessToken, setAccessTokenInput] = useState('')
  const [formError, setFormError] = useState<string>()

  function edit(profile: ServerProfile) {
    setSelectedId(profile.id)
    setEditingId(profile.id)
    setName(profile.name)
    setUrl(profile.baseUrl)
    setAccessTokenInput('')
    setFormError(undefined)
  }

  function addServer() {
    setEditingId(undefined)
    setName('')
    setUrl('')
    setAccessTokenInput('')
    setFormError(undefined)
  }

  useEffect(() => {
    if (open) edit(activeServer)
    // Reset the form only when the dialog opens or the active profile changes externally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeServer.id])

  if (!open) return null
  const editing = editingId ? servers.find(({ id }) => id === editingId) : undefined
  const configured = editing?.origin === 'configured'

  function save() {
    try {
      const savedId = saveServer({ name, url }, editingId, accessToken || undefined)
      setSelectedId(savedId)
      setEditingId(savedId)
      setAccessTokenInput('')
      setFormError(undefined)
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="dialog connection-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="connection-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="icon-button dialog-close" aria-label="Close" onClick={onClose}>
          <X size={18} />
        </button>
        <div className="eyebrow"><Link2 size={14} /> Connections</div>
        <h2 id="connection-title">Treetop servers</h2>
        <p className="muted">
          Switch the workbench between independent Treetop REST environments. This does not change either server.
        </p>

        <div className="connection-dialog-grid">
          <div className="server-profile-column">
            <div className="dialog-section-heading">
              <span>Saved servers</span>
              <button type="button" className="button ghost small" onClick={addServer}>
                <Plus size={13} /> New
              </button>
            </div>
            <div className="server-profile-list" role="listbox" aria-label="Treetop servers">
              {servers.map((server) => (
                <div
                  className={`server-profile ${selectedId === server.id ? 'selected' : ''}`}
                  key={server.id}
                >
                  <button
                    type="button"
                    role="option"
                    aria-selected={selectedId === server.id}
                    onClick={() => edit(server)}
                  >
                    <Server size={16} />
                    <span><strong>{server.name}</strong><small>{server.baseUrl}</small></span>
                    {server.id === activeServer.id && <i><Check size={12} /> Active</i>}
                    {accessTokenConfigured(server.id) && <i className="token-status">Token configured</i>}
                  </button>
                  {server.origin === 'browser' && (
                    <button
                      type="button"
                      className="server-profile-remove"
                      aria-label={`Remove ${server.name}`}
                      title={server.id === activeServer.id ? 'Switch servers before removing this connection' : 'Remove server'}
                      disabled={server.id === activeServer.id}
                      onClick={() => {
                        try {
                          removeServer(server.id)
                          if (selectedId === server.id) edit(activeServer)
                        } catch (cause) {
                          setFormError(cause instanceof Error ? cause.message : String(cause))
                        }
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="server-profile-editor">
            <div className="dialog-section-heading">
              <span>{editing ? 'Server details' : 'Add server'}</span>
              {configured && <em>Configured at startup</em>}
            </div>
            <label className="field-label" htmlFor="server-name">Name</label>
            <input
              id="server-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Production"
              disabled={configured}
              autoFocus={!editing}
            />
            <label className="field-label" htmlFor="server-url">Server URL</label>
            <input
              id="server-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="/treetop-production"
              disabled={configured}
            />
            <span className="field-help">
              Prefer a same-origin reverse-proxy path. Absolute URLs require suitable browser CORS configuration.
            </span>
            <label className="field-label" htmlFor="server-access-token">Access token</label>
            <input
              id="server-access-token"
              type="password"
              value={accessToken}
              onChange={(event) => setAccessTokenInput(event.target.value)}
              placeholder={editing && accessTokenConfigured(editing.id) ? 'Enter a replacement token' : 'Optional Bearer token'}
              autoComplete="off"
            />
            <span className="field-help">
              {editing && accessTokenConfigured(editing.id) ? 'Token configured. ' : ''}
              Kept in memory only and cleared when this page reloads.
            </span>
            {editing && (
              <div className="credential-actions">
                <button
                  type="button"
                  className="button secondary small"
                  disabled={!accessToken}
                  onClick={() => {
                    try {
                      setAccessToken(editing.id, accessToken)
                      setAccessTokenInput('')
                      setFormError(undefined)
                    } catch (cause) {
                      setFormError(cause instanceof Error ? cause.message : String(cause))
                    }
                  }}
                >
                  {accessTokenConfigured(editing.id) ? 'Replace token' : 'Set token'}
                </button>
                <button
                  type="button"
                  className="button ghost small"
                  disabled={!accessTokenConfigured(editing.id)}
                  onClick={() => {
                    clearAccessToken(editing.id)
                    setAccessTokenInput('')
                    setFormError(undefined)
                  }}
                >
                  Clear token
                </button>
              </div>
            )}
            {!configured && (
              <button type="button" className="button secondary server-save" onClick={save}>
                <Save size={14} /> {editing ? 'Save changes' : 'Save server'}
              </button>
            )}
          </div>
        </div>

        {(formError || error) && (
          <div className="inline-error">{formError ?? `Current connection: ${error?.message}`}</div>
        )}
        <div className="dialog-actions">
          <button className="button secondary" onClick={onClose}>Cancel</button>
          <button
            className="button primary"
            disabled={!selectedId}
            onClick={() => {
              connect(selectedId)
              onClose()
            }}
          >
            {loading && selectedId === activeServer.id ? 'Connecting…' : selectedId === activeServer.id ? 'Reconnect' : 'Connect'}
          </button>
        </div>
      </section>
    </div>
  )
}
