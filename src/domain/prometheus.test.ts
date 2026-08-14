import { describe, expect, it } from 'vitest'
import { aggregateMetric, histogramSeries, parsePrometheus } from './prometheus'

const source = String.raw`# HELP http_request_duration_seconds HTTP latency
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{method="POST",path="/api/v1/authorize",status_code="200",le="0.001"} 1
http_request_duration_seconds_bucket{method="POST",path="/api/v1/authorize",status_code="200",le="0.005"} 3
http_request_duration_seconds_bucket{method="POST",path="/api/v1/authorize",status_code="200",le="+Inf"} 4
http_request_duration_seconds_sum{method="POST",path="/api/v1/authorize",status_code="200"} 0.012
http_request_duration_seconds_count{method="POST",path="/api/v1/authorize",status_code="200"} 4
http_requests_total{client_ip="127.0.0.1",method="POST",path="/api/v1/authorize",status_code="200"} 4
http_requests_total{client_ip="10.0.0.2",method="POST",path="/api/v1/authorize",status_code="200"} 2
policy_evals_total{action="Action::\"view\""} 6
`

describe('Prometheus exposition parsing', () => {
  it('parses escaped labels, metadata, and samples', () => {
    const metrics = parsePrometheus(source)
    expect(metrics.help.http_request_duration_seconds).toBe('HTTP latency')
    expect(metrics.types.http_request_duration_seconds).toBe('histogram')
    expect(metrics.samples.find(({ name }) => name === 'policy_evals_total')?.labels.action).toBe('Action::"view"')
  })

  it('aggregates unwanted label dimensions and summarizes histograms', () => {
    const metrics = parsePrometheus(source)
    expect(aggregateMetric(metrics, 'http_requests_total', ['method', 'path', 'status_code'])).toEqual([{
      labels: { method: 'POST', path: '/api/v1/authorize', status_code: '200' },
      value: 6,
    }])
    expect(histogramSeries(metrics, 'http_request_duration_seconds')[0]).toMatchObject({
      count: 4,
      sum: 0.012,
      average: 0.003,
      buckets: [
        { upperBound: 0.001, count: 1, cumulativeCount: 1 },
        { upperBound: 0.005, count: 2, cumulativeCount: 3 },
        { upperBound: Number.POSITIVE_INFINITY, count: 1, cumulativeCount: 4 },
      ],
    })
  })
})
