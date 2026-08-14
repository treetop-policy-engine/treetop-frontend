export type PrometheusSample = {
  name: string
  labels: Record<string, string>
  value: number
}

export type PrometheusMetrics = {
  samples: PrometheusSample[]
  help: Record<string, string>
  types: Record<string, string>
}

export type HistogramSeries = {
  labels: Record<string, string>
  count: number
  sum: number
  average: number
  p95UpperBound?: number
  buckets: Array<{
    upperBound: number
    count: number
    cumulativeCount: number
  }>
}

function parseLabels(source: string) {
  const labels: Record<string, string> = {}
  let index = 0
  while (index < source.length) {
    while (source[index] === ',' || /\s/.test(source[index] ?? '')) index += 1
    const keyStart = index
    while (index < source.length && /[A-Za-z0-9_]/.test(source[index])) index += 1
    const key = source.slice(keyStart, index)
    while (/\s/.test(source[index] ?? '')) index += 1
    if (!key || source[index] !== '=') break
    index += 1
    while (/\s/.test(source[index] ?? '')) index += 1
    if (source[index] !== '"') break
    index += 1
    let value = ''
    while (index < source.length) {
      const character = source[index]
      if (character === '"') {
        index += 1
        break
      }
      if (character === '\\') {
        const escaped = source[index + 1]
        value += escaped === 'n' ? '\n' : escaped ?? ''
        index += 2
      } else {
        value += character
        index += 1
      }
    }
    labels[key] = value
  }
  return labels
}

export function parsePrometheus(source: string): PrometheusMetrics {
  const samples: PrometheusSample[] = []
  const help: Record<string, string> = {}
  const types: Record<string, string> = {}

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    const helpMatch = line.match(/^#\s+HELP\s+(\S+)\s+(.*)$/)
    if (helpMatch) {
      help[helpMatch[1]] = helpMatch[2]
      continue
    }
    const typeMatch = line.match(/^#\s+TYPE\s+(\S+)\s+(\S+)$/)
    if (typeMatch) {
      types[typeMatch[1]] = typeMatch[2]
      continue
    }
    if (line.startsWith('#')) continue

    const sample = line.match(/^([A-Za-z_:][A-Za-z0-9_:]*)(?:\{(.*)\})?\s+([^\s]+)(?:\s+\d+)?$/)
    if (!sample) continue
    const value = Number(sample[3])
    if (Number.isNaN(value)) continue
    samples.push({ name: sample[1], labels: parseLabels(sample[2] ?? ''), value })
  }

  return { samples, help, types }
}

function labelsKey(labels: Record<string, string>, excluded = new Set<string>()) {
  return Object.entries(labels)
    .filter(([key]) => !excluded.has(key))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}\u0000${value}`)
    .join('\u0001')
}

export function aggregateMetric(
  metrics: PrometheusMetrics,
  name: string,
  labelNames: string[],
) {
  const grouped = new Map<string, { labels: Record<string, string>; value: number }>()
  for (const sample of metrics.samples.filter((entry) => entry.name === name)) {
    const labels = Object.fromEntries(labelNames.map((label) => [label, sample.labels[label] ?? '']))
    const key = labelsKey(labels)
    const current = grouped.get(key)
    if (current) current.value += sample.value
    else grouped.set(key, { labels, value: sample.value })
  }
  return [...grouped.values()]
}

export function histogramSeries(metrics: PrometheusMetrics, name: string): HistogramSeries[] {
  const counts = metrics.samples.filter((sample) => sample.name === `${name}_count`)
  const sums = metrics.samples.filter((sample) => sample.name === `${name}_sum`)
  const buckets = metrics.samples.filter((sample) => sample.name === `${name}_bucket`)

  return counts.map((count) => {
    const key = labelsKey(count.labels)
    const sum = sums.find((sample) => labelsKey(sample.labels) === key)?.value ?? 0
    const matchingBuckets = buckets
      .filter((sample) => labelsKey(sample.labels, new Set(['le'])) === key)
      .map((sample) => ({
        upperBound: sample.labels.le === '+Inf' ? Number.POSITIVE_INFINITY : Number(sample.labels.le),
        cumulativeCount: sample.value,
      }))
      .sort((left, right) => left.upperBound - right.upperBound)
    const p95Target = count.value * 0.95
    const p95Bucket = matchingBuckets.find((bucket) => bucket.cumulativeCount >= p95Target)
    let previousCount = 0
    const distribution = matchingBuckets.map((bucket) => {
      const bucketCount = Math.max(0, bucket.cumulativeCount - previousCount)
      previousCount = bucket.cumulativeCount
      return { ...bucket, count: bucketCount }
    })
    return {
      labels: count.labels,
      count: count.value,
      sum,
      average: count.value ? sum / count.value : 0,
      ...(p95Bucket && Number.isFinite(p95Bucket.upperBound) ? { p95UpperBound: p95Bucket.upperBound } : {}),
      buckets: distribution,
    }
  })
}
