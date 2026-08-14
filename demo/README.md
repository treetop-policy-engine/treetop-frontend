# Demo environments

Each environment is a self-contained Cedar policy set with an optional JSON schema, optional label rules, provenance, and a few requests worth trying in the guided workbench.

| Environment | Demonstrates | Source |
| --- | --- | --- |
| `documents` | Group membership, multiple permits, and forbid precedence | Adapted from the treetop-core 0.0.19 schema/evaluation tests |
| `dns` | The server's DNS example, IP extensions, hostname label derivation, and forbids | Adapted from treetop-rest v0.0.10 `testdata/dns.cedar` and `labels.json` |
| `change-control` | Typed request context, risk conditions, and an emergency path | Ticket context adapted from treetop-core 0.0.19 schema tests |
| `schema-free` | Policy-inferred guided inputs, group grants, and forbid precedence without a Cedar schema | Extended from treetop-rest v0.0.10 `testdata/default.cedar` |

Run one natively:

```bash
npm run demo -- dns
```

The runner downloads and caches the official v0.0.12 Linux server, loads the selected schema and policy with both upload and Bearer credentials, starts Vite with server-side credential injection, prints example requests, and stops everything together on Ctrl+C. The `schema-free` environment deliberately uses permissive mode; its guided form infers principal, action, and resource choices from static policy scopes, while the provided JSON requests cover attributes or context that cannot be inferred safely. On another operating system, set `TREETOP_SERVER_BIN` to a local server executable or use Docker.

Run one with Docker:

```bash
TREETOP_DEMO=dns docker compose -f compose.demo.yml up --build
```

The schema-free profile uses a small override to leave the schema source unset:

```bash
TREETOP_DEMO=schema-free docker compose \
  -f compose.demo.yml \
  -f compose.demo.schema-free.yml \
  up --build
```

The Docker frontend is available at <http://127.0.0.1:4173> and the API at <http://127.0.0.1:9999>. Stop and remove the stack with:

```bash
docker compose -f compose.demo.yml down
```

To create another environment, copy one directory and keep these filenames:

- `policies.cedar` — Cedar policy source
- `schema.json` — Cedar JSON schema used by the guided form and server validator; omit it and set `"schema": false` in `demo.json` for a schema-free environment
- `labels.json` — label rules, or `[]` when unused
- `demo.json` — description, provenance, and suggested requests printed by the native runner

Validate every advertised example against the released server with `npm run test:demos`. This also asserts whether each profile is schema-backed or intentionally schema-free.
