# User guide

Treetop Workbench is an inspection and request-building interface for a running `treetop-rest` server. The active server is shown at the bottom of the sidebar. Use **Switch server** to move between independent environments.

## Playground

The Playground evaluates one or more Cedar authorization requests.

- **Guided** mode derives compatible principals, actions, resources, attributes, and context fields from the server's Cedar schema.
- When no schema is loaded, the workbench infers basic entity and action choices from static policy scopes. It cannot safely infer arbitrary attributes or conditions, so use JSON mode for those requests.
- **JSON** mode exposes the REST request directly.
- **Matrix** expands `|`-separated principal and resource IDs into one authorization batch.
- **Full detail** asks the server to include matching permit policies in successful decisions.

The decision is made entirely by the selected server. The workbench does not evaluate Cedar policies in the browser.

## Policies

**By source** shows the complete Cedar source currently returned by the server. Searching returns complete policies containing a matching line, rather than isolated lines without context.

**By principal** calls the server's static policy lookup. Enter the principal ID separately from its Cedar type and namespace. Group and namespace suggestions come from the schema or policy source where possible.

Lookup results explain static scope matches such as `PrincipalEq` and `PrincipalIn`. Conditions are not evaluated by this lookup. Expand individual results or use **Expand all**, then choose Cedar or JSON representation for each policy.

## Schema

The Schema explorer indexes the selected server's Cedar JSON schema:

- Actions show compatible principal and resource types plus action-specific context.
- Entities show their declared shapes, membership types, and attributes.
- Namespaces are preserved in fully qualified Cedar names.

An empty schema is a valid server configuration. In that case, the Playground uses its explicitly labelled policy-inference fallback.

## System

The System page identifies the active connection and reports:

- server, `treetop-core`, and Cedar versions;
- liveness and readiness probes;
- policy source, entry count, upload state, and refresh interval;
- schema validation and request-context mode;
- worker and Rayon parallelism;
- enforced batch and context limits; and
- policy and schema hashes and load times.

Use **Servers** to switch connections or manage an optional per-server Bearer credential. The workbench reports only whether the memory-only token is configured; refreshing data retains it, while a full page reload clears it. Refreshing reloads the current server snapshot without changing connections.

## Metrics

The Metrics page fetches `/metrics` on demand and parses Prometheus exposition in the browser. It shows:

- request counts grouped by method, route, and status;
- mean HTTP request latency and histogram buckets;
- policy evaluation latency grouped by Cedar action;
- allow and deny counts and rates; and
- reload counters and build information.

Select a latency row to inspect the non-cumulative observations in each histogram bucket. The displayed p95 is a Prometheus bucket upper bound, not an interpolated percentile. Use **Raw** when you need the original metric text.

Metrics are a snapshot and do not poll automatically. Choose **Refresh** to retrieve a new sample.
