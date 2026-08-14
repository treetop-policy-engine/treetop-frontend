export const cedarSchema = {
  App: {
    commonTypes: {
      RequestContext: {
        type: 'Record',
        attributes: {
          environment: { type: 'String', annotations: { doc: 'Deployment environment' } },
          trusted: { type: 'Boolean', required: false },
        },
        additionalAttributes: false,
      },
    },
    entityTypes: {
      User: { memberOfTypes: ['Group'] },
      Group: {},
      Document: {
        shape: {
          type: 'Record',
          attributes: {
            id: { type: 'String' },
            title: { type: 'String' },
            revision: { type: 'Long' },
            address: { type: 'Extension', name: 'ipaddr', required: false },
            tags: { type: 'Set', element: { type: 'String' }, required: false },
            metadata: { type: 'Record', attributes: {}, required: false },
          },
        },
      },
    },
    actions: {
      read: {
        annotations: { doc: 'Read a document' },
        appliesTo: {
          principalTypes: ['User'],
          resourceTypes: ['Document'],
          context: { type: 'RequestContext' },
        },
      },
      allDocuments: {
        appliesTo: { principalTypes: [], resourceTypes: [] },
      },
    },
  },
}

export const policySource = `@id("App.read_documents")
permit (
    principal in App::Group::"readers",
    action == App::Action::"read",
    resource is App::Document
)
when { context.environment == "prod" };`

export const statusResponse = {
  policy_configuration: {
    allow_upload: false,
    schema_validation_mode: 'strict',
    policies: { timestamp: '2026-08-12T12:00:00Z', sha256: 'a'.repeat(64), size: 187, entries: 1, content: policySource },
    labels: { timestamp: '2026-08-12T12:00:00Z', sha256: 'b'.repeat(64), size: 2, entries: 0, content: '[]' },
    schema: { timestamp: '2026-08-12T12:00:00Z', sha256: 'c'.repeat(64), size: 900, entries: 1, content: JSON.stringify(cedarSchema) },
  },
  parallel_configuration: { workers: 4, cpu_count: 4, rayon_threads: 4, par_threshold: 4, allow_parallel: true },
  request_limits: { max_batch_size: 128, max_context_bytes: 16384, max_context_depth: 8, max_context_keys: 64 },
  request_context: { supported: true, schema_backed: true, fallback_reason: null },
}

export const versionResponse = {
  version: '0.0.10',
  core: { version: '0.0.19', cedar: '4.12.0' },
  policies: { hash: 'a'.repeat(64), loaded_at: '2026-08-12T12:00:00Z' },
  schema: { hash: 'c'.repeat(64), loaded_at: '2026-08-12T12:00:00Z' },
}

export const metricsSource = String.raw`# HELP http_request_duration_seconds HTTP request latency in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{method="GET",path="/api/v1/policies",status_code="200",le="0.0001"} 2
http_request_duration_seconds_bucket{method="GET",path="/api/v1/policies",status_code="200",le="0.005"} 5
http_request_duration_seconds_bucket{method="GET",path="/api/v1/policies",status_code="200",le="+Inf"} 5
http_request_duration_seconds_sum{method="GET",path="/api/v1/policies",status_code="200"} 0.001
http_request_duration_seconds_count{method="GET",path="/api/v1/policies",status_code="200"} 5
http_request_duration_seconds_bucket{method="POST",path="/api/v1/authorize",status_code="200",le="0.0005"} 1
http_request_duration_seconds_bucket{method="POST",path="/api/v1/authorize",status_code="200",le="0.005"} 4
http_request_duration_seconds_bucket{method="POST",path="/api/v1/authorize",status_code="200",le="+Inf"} 4
http_request_duration_seconds_sum{method="POST",path="/api/v1/authorize",status_code="200"} 0.004
http_request_duration_seconds_count{method="POST",path="/api/v1/authorize",status_code="200"} 4
# HELP authorization_batch_size Authorization checks per completed, accepted POST /api/v1/authorize request
# TYPE authorization_batch_size histogram
authorization_batch_size_bucket{le="1.0"} 1
authorization_batch_size_bucket{le="4.0"} 4
authorization_batch_size_bucket{le="+Inf"} 4
authorization_batch_size_sum 10
authorization_batch_size_count 4
# HELP authorization_request_duration_seconds Server-side authorization latency by bounded batch-size class
# TYPE authorization_request_duration_seconds histogram
authorization_request_duration_seconds_bucket{batch_size_class="1",le="0.0005"} 0
authorization_request_duration_seconds_bucket{batch_size_class="1",le="0.005"} 1
authorization_request_duration_seconds_bucket{batch_size_class="1",le="+Inf"} 1
authorization_request_duration_seconds_sum{batch_size_class="1"} 0.001
authorization_request_duration_seconds_count{batch_size_class="1"} 1
authorization_request_duration_seconds_bucket{batch_size_class="2-4",le="0.0005"} 0
authorization_request_duration_seconds_bucket{batch_size_class="2-4",le="0.005"} 3
authorization_request_duration_seconds_bucket{batch_size_class="2-4",le="+Inf"} 3
authorization_request_duration_seconds_sum{batch_size_class="2-4"} 0.009
authorization_request_duration_seconds_count{batch_size_class="2-4"} 3
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{client_ip="127.0.0.1",method="GET",path="/api/v1/policies",status_code="200"} 5
http_requests_total{client_ip="127.0.0.1",method="POST",path="/api/v1/authorize",status_code="200"} 4
# HELP policy_eval_duration_seconds Policy evaluation latency in seconds
# TYPE policy_eval_duration_seconds histogram
policy_eval_duration_seconds_bucket{action="Action::\"read\"",le="0.0001"} 1
policy_eval_duration_seconds_bucket{action="Action::\"read\"",le="0.005"} 4
policy_eval_duration_seconds_bucket{action="Action::\"read\"",le="+Inf"} 4
policy_eval_duration_seconds_sum{action="Action::\"read\""} 0.0008
policy_eval_duration_seconds_count{action="Action::\"read\""} 4
policy_evals_allowed_total{action="Action::\"read\""} 3
policy_evals_denied_total{action="Action::\"read\""} 1
policy_evals_total{action="Action::\"read\""} 4
policy_reloads_total 2
schema_reloads_total 1
treetop_build_info{app_version="v0.0.10",cedar_version="4.12.0",core_version="0.0.19"} 1
`
