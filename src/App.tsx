import { useEffect, useState } from 'react'
import {
  Activity,
  BarChart3,
  BookOpenText,
  Braces,
  ChevronRight,
  FlaskConical,
  Link2,
  Menu,
  RefreshCw,
  TreePine,
  X,
} from 'lucide-react'
import { useWorkspace } from './app/workspace'
import { ConnectionDialog } from './components/ConnectionDialog'
import { MetricsPage } from './pages/MetricsPage'
import { PlaygroundPage } from './pages/PlaygroundPage'
import { PoliciesPage } from './pages/PoliciesPage'
import { SchemaPage } from './pages/SchemaPage'
import { SystemPage } from './pages/SystemPage'

type Page = 'playground' | 'policies' | 'schema' | 'system' | 'metrics'

const navigation: Array<{ id: Page; label: string; caption: string; icon: typeof Activity }> = [
  { id: 'playground', label: 'Playground', caption: 'Evaluate requests', icon: FlaskConical },
  { id: 'policies', label: 'Policies', caption: 'Inspect matching rules', icon: BookOpenText },
  { id: 'schema', label: 'Schema', caption: 'Explore the model', icon: Braces },
  { id: 'system', label: 'System', caption: 'Runtime & health', icon: Activity },
  { id: 'metrics', label: 'Metrics', caption: 'Traffic & decisions', icon: BarChart3 },
]

function pageFromHash(): Page {
  const value = window.location.hash.slice(1)
  return navigation.some(({ id }) => id === value) ? (value as Page) : 'playground'
}

export default function App() {
  const { loading, error, authenticationRequired, status, activeServer, baseUrl, refresh } = useWorkspace()
  const [page, setPage] = useState(pageFromHash)
  const [connectionOpen, setConnectionOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    const onHash = () => setPage(pageFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const navigate = (next: Page) => {
    window.location.hash = next
    setPage(next)
    setNavOpen(false)
  }

  const current = navigation.find(({ id }) => id === page)!
  const contextState = status?.request_context

  return (
    <div className="app-shell">
      <aside className={`sidebar ${navOpen ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><TreePine size={24} strokeWidth={1.8} /></div>
          <div><strong>Treetop</strong><span>Policy workbench</span></div>
          <button className="icon-button mobile-only" onClick={() => setNavOpen(false)} aria-label="Close navigation"><X size={19} /></button>
        </div>
        <nav aria-label="Primary navigation">
          {navigation.map((item) => {
            const Icon = item.icon
            return (
              <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => navigate(item.id)}>
                <Icon size={19} strokeWidth={1.8} />
                <span><strong>{item.label}</strong><small>{item.caption}</small></span>
                <ChevronRight className="nav-chevron" size={16} />
              </button>
            )
          })}
        </nav>
        <div className="sidebar-footer">
          <div className={`connection-state ${error ? 'offline' : loading ? 'pending' : 'online'}`}>
            <span className="status-dot" />
            <div>
              <strong>{activeServer.name} · {error ? 'Disconnected' : loading ? 'Connecting' : 'Connected'}</strong>
              <small>{baseUrl}</small>
            </div>
          </div>
          <button className="connection-button" onClick={() => setConnectionOpen(true)}><Link2 size={15} /> Switch server</button>
        </div>
      </aside>
      {navOpen && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setNavOpen(false)} />}

      <main>
        <header className="topbar">
          <button className="icon-button mobile-only" onClick={() => setNavOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
          <div>
            <span className="breadcrumb">Workbench /</span>
            <h1>{current.label}</h1>
          </div>
          <div className="topbar-actions">
            {contextState && (
              <span className={`schema-pill ${contextState.schema_backed ? 'good' : 'warn'}`}>
                <span className="status-dot" />
                {contextState.schema_backed ? 'Schema-backed' : 'Schema fallback'}
              </span>
            )}
            <button className="icon-button" onClick={() => void refresh()} aria-label="Refresh server data" disabled={loading}>
              <RefreshCw size={18} className={loading ? 'spin' : ''} />
            </button>
          </div>
        </header>

        <div className="page-container">
          {error && page !== 'system' && (
            <div className="banner error-banner">
              <strong>{authenticationRequired ? 'Access token required.' : 'Couldn’t reach the server.'}</strong>
              <span>{authenticationRequired ? 'Set or replace the credential for this connection.' : error.message}</span>
              <button className="button small" onClick={() => setConnectionOpen(true)}>
                {authenticationRequired ? 'Configure credential' : 'Connection'}
              </button>
            </div>
          )}
          {page === 'playground' && <PlaygroundPage />}
          {page === 'policies' && <PoliciesPage />}
          {page === 'schema' && <SchemaPage />}
          {page === 'system' && <SystemPage onConfigure={() => setConnectionOpen(true)} />}
          {page === 'metrics' && <MetricsPage />}
        </div>
      </main>
      <ConnectionDialog open={connectionOpen} onClose={() => setConnectionOpen(false)} />
    </div>
  )
}
