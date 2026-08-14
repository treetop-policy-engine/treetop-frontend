import { useEffect, useState } from 'react'
import { Cpu, Database, FileJson2, Gauge, Radio, Server, Settings2 } from 'lucide-react'
import { useWorkspace } from '../app/workspace'

export function SystemPage({ onConfigure }: { onConfigure: () => void }) {
  const { client, activeServer, baseUrl, status, version, error, authenticationRequired, loading } = useWorkspace()
  const [probes, setProbes] = useState<{ live?: boolean; ready?: boolean }>({})

  useEffect(() => {
    let active = true
    setProbes({})
    Promise.allSettled([client.live(), client.ready()]).then(([live, ready]) => {
      if (active) setProbes({ live: live.status === 'fulfilled', ready: ready.status === 'fulfilled' })
    })
    return () => { active = false }
  }, [client])

  const policyConfig = status?.policy_configuration
  const limits = status?.request_limits
  const parallel = status?.parallel_configuration

  return (
    <div>
      <div className="page-heading">
        <div><div className="eyebrow">Runtime overview</div><h2>System status</h2><p>Version, policy snapshot, evaluation mode, limits, and operational health.</p></div>
        <button className="button secondary" onClick={onConfigure}><Settings2 size={16} /> Servers</button>
      </div>

      <section className={`connection-hero ${error ? 'offline' : ''}`}>
        <div className="hero-status"><span className="pulse-ring"><Server size={24} /></span><div><span>{error ? `${activeServer.name} is unavailable` : loading ? `Contacting ${activeServer.name}` : `${activeServer.name} is online`}</span><strong>{baseUrl}</strong></div></div>
        <div className="probe-list"><Probe label="Live" value={probes.live} /><Probe label="Ready" value={probes.ready} /></div>
      </section>
      {error && (
        <div className="banner error-banner">
          <strong>{authenticationRequired ? 'Access token required.' : 'Connection error.'}</strong>
          <span>{authenticationRequired ? 'Open Servers to set or replace the in-memory credential.' : error.message}</span>
        </div>
      )}

      <div className="system-grid">
        <StatusCard icon={<Server size={19} />} title="Versions">
          <Row label="Server" value={version?.version} />
          <Row label="Treetop core" value={version?.core.version} />
          <Row label="Cedar" value={version?.core.cedar} />
        </StatusCard>
        <StatusCard icon={<Database size={19} />} title="Policies">
          <Row label="Entries" value={policyConfig?.policies.entries} />
          <Row label="Upload" value={policyConfig ? (policyConfig.allow_upload ? 'Enabled' : 'Disabled') : undefined} />
          <Row label="Source" value={policyConfig?.policies.source?.url ?? 'Local'} />
          <Row label="Refresh" value={policyConfig?.policies.refresh_frequency ? `${policyConfig.policies.refresh_frequency}s` : 'Manual'} />
        </StatusCard>
        <StatusCard icon={<FileJson2 size={19} />} title="Schema & context">
          <Row label="Mode" value={policyConfig?.schema_validation_mode} />
          <Row label="Schema-backed" value={status?.request_context ? (status.request_context.schema_backed ? 'Yes' : 'No') : undefined} />
          <Row label="Fallback" value={status?.request_context?.fallback_reason ?? 'None'} />
          <Row label="Entries" value={policyConfig?.schema.entries} />
        </StatusCard>
        <StatusCard icon={<Cpu size={19} />} title="Parallelism">
          <Row label="CPUs" value={parallel?.cpu_count} />
          <Row label="Workers" value={parallel?.workers} />
          <Row label="Rayon threads" value={parallel?.rayon_threads} />
          <Row label="Parallel cutoff" value={parallel?.par_threshold} />
        </StatusCard>
        <StatusCard icon={<Gauge size={19} />} title="Request limits">
          <Row label="Batch size" value={limits?.max_batch_size ?? 'Legacy / unlimited'} />
          <Row label="Context bytes" value={limits?.max_context_bytes} />
          <Row label="Context depth" value={limits?.max_context_depth} />
          <Row label="Context keys" value={limits?.max_context_keys} />
        </StatusCard>
        <StatusCard icon={<Radio size={19} />} title="Current snapshot">
          <Row label="Policy hash" value={version?.policies.hash ? `${version.policies.hash.slice(0, 12)}…` : undefined} mono />
          <Row label="Policy loaded" value={version?.policies.loaded_at ? new Date(version.policies.loaded_at).toLocaleString() : undefined} />
          <Row label="Schema hash" value={version?.schema?.hash ? `${version.schema.hash.slice(0, 12)}…` : 'None'} mono />
        </StatusCard>
      </div>

    </div>
  )
}

function Probe({ label, value }: { label: string; value?: boolean }) {
  return <div className={value === undefined ? 'pending' : value ? 'good' : 'bad'}><span className="status-dot" /><span>{label}</span><strong>{value === undefined ? 'Checking' : value ? 'OK' : 'Failed'}</strong></div>
}

function StatusCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return <section className="panel status-card"><div className="status-card-title">{icon}<h3>{title}</h3></div><div className="status-rows">{children}</div></section>
}

function Row({ label, value, mono }: { label: string; value?: string | number | null; mono?: boolean }) {
  return <div><span>{label}</span><strong className={mono ? 'mono' : ''}>{value ?? '—'}</strong></div>
}
