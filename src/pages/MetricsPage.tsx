import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Activity, Clock3, Gauge, RefreshCw, ShieldCheck, X } from 'lucide-react'
import { useWorkspace } from '../app/workspace'
import { aggregateMetric, histogramSeries, parsePrometheus, type HistogramSeries } from '../domain/prometheus'

type BarRow = {
  key: string
  label: string
  detail?: string
  value: number
  displayValue: string
  secondary?: string
  tone?: 'green' | 'orange' | 'blue'
  histogram?: HistogramSeries
}

function formatInteger(value: number) {
  return new Intl.NumberFormat().format(value)
}

function formatDuration(seconds: number) {
  if (seconds < 0.001) return `${(seconds * 1_000_000).toFixed(seconds < 0.0001 ? 1 : 0)} µs`
  if (seconds < 1) return `${(seconds * 1_000).toFixed(seconds < 0.01 ? 2 : 1)} ms`
  return `${seconds.toFixed(2)} s`
}

function displayAction(action: string) {
  return action.replace(/::"((?:\\.|[^"\\])*)"/g, '::$1')
}

function sumValues(rows: Array<{ value: number }>) {
  return rows.reduce((sum, row) => sum + row.value, 0)
}

export function MetricsPage() {
  const { client } = useWorkspace()
  const [source, setSource] = useState<string>()
  const [view, setView] = useState<'overview' | 'raw'>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [loadedAt, setLoadedAt] = useState<Date>()
  const [selectedHistogram, setSelectedHistogram] = useState<{ title: string; series: HistogramSeries }>()
  const loadSequence = useRef(0)

  useEffect(() => {
    const sequence = ++loadSequence.current
    setLoading(true)
    setError(undefined)
    setSource(undefined)
    setLoadedAt(undefined)
    setSelectedHistogram(undefined)
    client.metrics().then((metrics) => {
      if (sequence !== loadSequence.current) return
      setSource(metrics)
      setLoadedAt(new Date())
    }).catch((cause: unknown) => {
      if (sequence === loadSequence.current) {
        setError(cause instanceof Error ? cause.message : String(cause))
      }
    }).finally(() => {
      if (sequence === loadSequence.current) setLoading(false)
    })
  }, [client])

  useEffect(() => {
    if (!selectedHistogram) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedHistogram(undefined)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [selectedHistogram])

  async function refresh() {
    const sequence = ++loadSequence.current
    setLoading(true)
    setError(undefined)
    try {
      const metrics = await client.metrics()
      if (sequence !== loadSequence.current) return
      setSource(metrics)
      setLoadedAt(new Date())
    } catch (cause) {
      if (sequence === loadSequence.current) {
        setError(cause instanceof Error ? cause.message : String(cause))
      }
    } finally {
      if (sequence === loadSequence.current) setLoading(false)
    }
  }

  const dashboard = useMemo(() => {
    const metrics = parsePrometheus(source ?? '')
    const requests = aggregateMetric(metrics, 'http_requests_total', ['method', 'path', 'status_code'])
      .sort((left, right) => right.value - left.value)
    const requestLatency = histogramSeries(metrics, 'http_request_duration_seconds')
      .sort((left, right) => right.average - left.average)
    const policyLatency = histogramSeries(metrics, 'policy_eval_duration_seconds')
      .sort((left, right) => right.average - left.average)
    const evaluations = aggregateMetric(metrics, 'policy_evals_total', ['action'])
    const allowed = aggregateMetric(metrics, 'policy_evals_allowed_total', ['action'])
    const denied = aggregateMetric(metrics, 'policy_evals_denied_total', ['action'])
    const actionNames = new Set([
      ...evaluations.map(({ labels }) => labels.action),
      ...allowed.map(({ labels }) => labels.action),
      ...denied.map(({ labels }) => labels.action),
    ])
    const decisions = [...actionNames].map((action) => ({
      action,
      total: evaluations.find(({ labels }) => labels.action === action)?.value ?? 0,
      allowed: allowed.find(({ labels }) => labels.action === action)?.value ?? 0,
      denied: denied.find(({ labels }) => labels.action === action)?.value ?? 0,
    })).sort((left, right) => right.total - left.total)
    const totalPolicyLatency = policyLatency.reduce((sum, series) => sum + series.sum, 0)
    const totalPolicyLatencyCount = policyLatency.reduce((sum, series) => sum + series.count, 0)
    const build = metrics.samples.find(({ name }) => name === 'treetop_build_info')?.labels
    const reloads = [
      { label: 'Policy reloads', value: sumValues(aggregateMetric(metrics, 'policy_reloads_total', [])) },
      { label: 'Schema reloads', value: sumValues(aggregateMetric(metrics, 'schema_reloads_total', [])) },
    ]

    return {
      requests,
      requestLatency,
      policyLatency,
      decisions,
      totalRequests: sumValues(requests),
      totalEvaluations: sumValues(evaluations),
      totalAllowed: sumValues(allowed),
      totalDenied: sumValues(denied),
      averagePolicyLatency: totalPolicyLatencyCount ? totalPolicyLatency / totalPolicyLatencyCount : 0,
      policyLatencyCount: totalPolicyLatencyCount,
      build,
      reloads,
      sampleCount: metrics.samples.length,
    }
  }, [source])

  const requestRows: BarRow[] = dashboard.requests.map(({ labels, value }) => ({
    key: `${labels.method}-${labels.path}-${labels.status_code}`,
    label: `${labels.method} ${labels.path}`,
    detail: labels.status_code,
    value,
    displayValue: formatInteger(value),
    tone: 'green',
  }))
  const requestLatencyRows: BarRow[] = dashboard.requestLatency.map((series) => ({
    key: `${series.labels.method}-${series.labels.path}-${series.labels.status_code}`,
    label: `${series.labels.method} ${series.labels.path}`,
    detail: `${series.labels.status_code} · ${formatInteger(series.count)} requests`,
    value: series.average,
    displayValue: formatDuration(series.average),
    secondary: series.p95UpperBound !== undefined ? `p95 bucket ≤ ${formatDuration(series.p95UpperBound)}` : undefined,
    tone: 'blue',
    histogram: series,
  }))
  const policyLatencyRows: BarRow[] = dashboard.policyLatency.map((series) => ({
    key: series.labels.action,
    label: displayAction(series.labels.action),
    detail: `${formatInteger(series.count)} evaluations`,
    value: series.average,
    displayValue: formatDuration(series.average),
    secondary: series.p95UpperBound !== undefined ? `p95 bucket ≤ ${formatDuration(series.p95UpperBound)}` : undefined,
    tone: 'orange',
    histogram: series,
  }))
  const decisionCount = dashboard.totalAllowed + dashboard.totalDenied
  const allowRate = decisionCount ? dashboard.totalAllowed / decisionCount : 0

  return (
    <div>
      <div className="page-heading">
        <div>
          <div className="eyebrow">Operational telemetry</div>
          <h2>Metrics snapshot</h2>
          <p>Explore request traffic, latency histograms, and policy decisions from the server’s Prometheus endpoint.</p>
        </div>
        <div className="metrics-heading-actions">
          <div className="segmented" aria-label="Metrics representation">
            <button className={view === 'overview' ? 'active' : ''} onClick={() => setView('overview')}>Overview</button>
            <button className={view === 'raw' ? 'active' : ''} onClick={() => setView('raw')}>Raw</button>
          </div>
          <button className="button secondary" disabled={loading} onClick={() => void refresh()}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} /> {source ? 'Refresh' : 'Load metrics'}
          </button>
        </div>
      </div>

      {error && <div className="banner error-banner"><strong>Metrics unavailable.</strong><span>{error}</span></div>}
      {loadedAt && <div className="metrics-captured">Snapshot captured {loadedAt.toLocaleString()} · {formatInteger(dashboard.sampleCount)} samples</div>}

      {view === 'raw' ? (
        <section className="panel metrics-raw">
          {source ? <pre aria-label="Raw Prometheus metrics">{source}</pre> : <div className="metrics-loading">{loading ? 'Loading metrics…' : 'No metrics loaded.'}</div>}
        </section>
      ) : !source ? (
        <section className="panel metrics-loading">{loading ? 'Loading metrics…' : 'No metrics loaded.'}</section>
      ) : (
        <>
          <div className="metrics-summary">
            <SummaryCard icon={<Activity size={18} />} label="HTTP requests" value={formatInteger(dashboard.totalRequests)} detail={`${requestRows.length} route series`} />
            <SummaryCard icon={<ShieldCheck size={18} />} label="Policy evaluations" value={formatInteger(dashboard.totalEvaluations)} detail={`${dashboard.decisions.length} actions`} />
            <SummaryCard icon={<Gauge size={18} />} label="Allow rate" value={decisionCount ? `${(allowRate * 100).toFixed(1)}%` : '—'} detail={`${formatInteger(dashboard.totalAllowed)} allow · ${formatInteger(dashboard.totalDenied)} deny`} />
            <SummaryCard icon={<Clock3 size={18} />} label="Mean evaluation" value={dashboard.policyLatencyCount ? formatDuration(dashboard.averagePolicyLatency) : '—'} detail="Across all actions" />
          </div>

          <div className="metrics-chart-grid">
            <BarChart title="HTTP request volume" description="Cumulative requests grouped by method, route, and status" rows={requestRows} empty="No HTTP request counter series found." />
            <BarChart title="Average HTTP latency" description="Histogram sum ÷ count; select a route to inspect every bucket" rows={requestLatencyRows} empty="No HTTP latency histogram found." onSelect={(row) => row.histogram && setSelectedHistogram({ title: row.label, series: row.histogram })} />
            <DecisionChart rows={dashboard.decisions} />
            <BarChart title="Average policy evaluation latency" description="Grouped by Cedar action; select one to inspect every bucket" rows={policyLatencyRows} empty="No policy evaluation histogram found." onSelect={(row) => row.histogram && setSelectedHistogram({ title: row.label, series: row.histogram })} />
          </div>

          <section className="panel metrics-runtime">
            <div><span>Policy reloads</span><strong>{formatInteger(dashboard.reloads[0].value)}</strong></div>
            <div><span>Schema reloads</span><strong>{formatInteger(dashboard.reloads[1].value)}</strong></div>
            <div><span>Server</span><strong>{dashboard.build?.app_version ?? '—'}</strong></div>
            <div><span>Core / Cedar</span><strong>{dashboard.build ? `${dashboard.build.core_version} / ${dashboard.build.cedar_version}` : '—'}</strong></div>
          </section>
        </>
      )}
      {selectedHistogram && <HistogramDialog title={selectedHistogram.title} series={selectedHistogram.series} onClose={() => setSelectedHistogram(undefined)} />}
    </div>
  )
}

function SummaryCard({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return <section className="panel metric-summary-card"><div>{icon}<span>{label}</span></div><strong>{value}</strong><small>{detail}</small></section>
}

function BarChart({ title, description, rows, empty, onSelect }: { title: string; description: string; rows: BarRow[]; empty: string; onSelect?: (row: BarRow) => void }) {
  const max = Math.max(...rows.map(({ value }) => value), 0)
  return (
    <section className="panel metric-chart">
      <div className="metric-chart-heading"><h3>{title}</h3><p>{description}</p></div>
      {!rows.length ? <p className="field-empty">{empty}</p> : <div className="metric-bars">
        {rows.map((row) => {
          const content = <>
            <div className="metric-bar-label"><code>{row.label}</code>{row.detail && <span>{row.detail}</span>}</div>
            <div className="metric-bar-value"><strong>{row.displayValue}</strong>{row.secondary && <span>{row.secondary}</span>}</div>
            <div className="metric-bar-track" aria-label={`${row.label}: ${row.displayValue}`}>
              <i className={row.tone} style={{ '--metric-width': `${max ? Math.max((row.value / max) * 100, 1) : 0}%` } as CSSProperties} />
            </div>
          </>
          return onSelect ? (
            <button type="button" className="metric-bar-row interactive" aria-label={`Open histogram for ${row.label}`} onClick={() => onSelect(row)} key={row.key}>{content}</button>
          ) : <div className="metric-bar-row" key={row.key}>{content}</div>
        })}
      </div>}
    </section>
  )
}

function bucketLabel(series: HistogramSeries, index: number) {
  const upperBound = series.buckets[index].upperBound
  const previous = index > 0 ? series.buckets[index - 1].upperBound : 0
  if (!Number.isFinite(upperBound)) return Number.isFinite(previous) ? `> ${formatDuration(previous)}` : '+Inf'
  if (index === 0) return `≤ ${formatDuration(upperBound)}`
  return `${formatDuration(previous)}–${formatDuration(upperBound)}`
}

function HistogramDialog({ title, series, onClose }: { title: string; series: HistogramSeries; onClose: () => void }) {
  const max = Math.max(...series.buckets.map(({ count }) => count), 0)
  const labels = Object.entries(series.labels).filter(([key]) => key !== 'le')
  return (
    <div className="dialog-backdrop histogram-backdrop" onMouseDown={onClose}>
      <section className="dialog histogram-dialog" role="dialog" aria-modal="true" aria-labelledby="histogram-title" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="icon-button dialog-close" onClick={onClose} aria-label="Close histogram"><X size={17} /></button>
        <div className="eyebrow">Latency distribution</div>
        <h2 id="histogram-title">{title}</h2>
        <div className="histogram-labels">{labels.map(([key, value]) => <span key={key}><i>{key}</i><code>{key === 'action' ? displayAction(value) : value}</code></span>)}</div>
        <div className="histogram-summary">
          <div><span>Observations</span><strong>{formatInteger(series.count)}</strong></div>
          <div><span>Mean</span><strong>{formatDuration(series.average)}</strong></div>
          <div><span>Total duration</span><strong>{formatDuration(series.sum)}</strong></div>
          <div><span>p95 bucket</span><strong>{series.p95UpperBound === undefined ? 'Above finite buckets' : `≤ ${formatDuration(series.p95UpperBound)}`}</strong></div>
        </div>
        <div className="histogram-table-heading"><span>Latency bucket</span><span>Observations</span><span>Cumulative</span></div>
        <div className="histogram-buckets">
          {series.buckets.map((bucket, index) => (
            <div className="histogram-bucket" key={String(bucket.upperBound)}>
              <code>{bucketLabel(series, index)}</code>
              <div className="histogram-bucket-track"><i style={{ '--bucket-width': `${max ? (bucket.count / max) * 100 : 0}%` } as CSSProperties} /></div>
              <strong>{formatInteger(bucket.count)}</strong>
              <span>{formatInteger(bucket.cumulativeCount)}</span>
            </div>
          ))}
        </div>
        <p className="histogram-note">Bucket bars show non-cumulative observations, derived from differences between the cumulative Prometheus buckets.</p>
      </section>
    </div>
  )
}

function DecisionChart({ rows }: { rows: Array<{ action: string; total: number; allowed: number; denied: number }> }) {
  const max = Math.max(...rows.map(({ total }) => total), 0)
  return (
    <section className="panel metric-chart">
      <div className="metric-chart-heading decision-heading"><div><h3>Policy decisions</h3><p>Allow and deny outcomes grouped by Cedar action</p></div><div className="decision-legend"><span className="allow">Allow</span><span className="deny">Deny</span></div></div>
      {!rows.length ? <p className="field-empty">No policy decision counters found.</p> : <div className="metric-bars decision-bars">
        {rows.map((row) => {
          const measured = row.allowed + row.denied
          const total = row.total || measured
          return (
            <div className="metric-bar-row" key={row.action}>
              <div className="metric-bar-label"><code>{displayAction(row.action)}</code><span>{formatInteger(total)} evaluations</span></div>
              <div className="metric-bar-value"><strong>{total ? `${((row.allowed / total) * 100).toFixed(0)}% allowed` : 'No outcomes'}</strong><span>{formatInteger(row.allowed)} / {formatInteger(row.denied)}</span></div>
              <div className="metric-bar-track decision-track" aria-label={`${displayAction(row.action)}: ${row.allowed} allowed, ${row.denied} denied`}>
                <div style={{ width: `${max ? (total / max) * 100 : 0}%` }}>
                  <i className="allowed" style={{ width: `${total ? (row.allowed / total) * 100 : 0}%` }} />
                  <i className="denied" style={{ width: `${total ? (row.denied / total) * 100 : 0}%` }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>}
    </section>
  )
}
