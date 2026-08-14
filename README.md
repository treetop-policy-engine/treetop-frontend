# Treetop Workbench

A browser workbench for
[`treetop-rest`](https://github.com/treetop-policy-engine/treetop-rest). It combines the server's
OpenAPI contract with its runtime Cedar schema to build safer authorization requests.

The workbench can:

- build schema-guided authorization requests, with a policy-inferred fallback when no schema is present;
- inspect complete Cedar policies and find policies by principal;
- explore Cedar entities, actions, resource types, and request context;
- visualize Prometheus request, decision, and latency metrics; and
- save and switch between independent Treetop REST servers such as test and production.

The frontend is read-only with respect to server configuration. Switching connections changes which server the browser queries; it does not copy, upload, or reconfigure policy data.

## Quick start

```bash
npm install
npm run dev
```

Open <http://127.0.0.1:5173>. Vite proxies `/treetop-api` to `http://127.0.0.1:9999` by default. Override that target with `VITE_TREETOP_PROXY_TARGET`.

### Container

Tagged releases are published as multi-architecture Alpine images at
`ghcr.io/treetop-policy-engine/treetop-frontend`. The image runs unprivileged and listens on
port 8080:

```bash
docker run --rm -p 8080:8080 \
  -e TREETOP_API_URL=https://treetop.example.com \
  ghcr.io/treetop-policy-engine/treetop-frontend:latest
```

Images formerly published under personal namespaces are not updated. Use the organization-owned
GHCR path for all new deployments.

The same command works with `podman`. For a same-origin proxy, put the frontend
and server on the same container network and set
`TREETOP_PROXY_TARGET=http://<server-name>:9999`. See
[Container and static deployment](docs/deployment.md) for all environment
variables, multiple servers, credentials, hardening, and versioned static
release archives.

## Server connections

Use **Switch server** in the sidebar to select a configured server or save another connection in the browser. Browser-added connections and the active selection are stored in local storage. Startup-configured connections remain read-only in the UI.

Configure multiple servers at startup with public JSON in `.env.local`:

```dotenv
VITE_TREETOP_SERVER_PROFILES={"defaultServer":"test","servers":[{"id":"test","name":"Test","url":"/treetop-test"},{"id":"production","name":"Production","url":"/treetop-production"}]}
VITE_TREETOP_PROXY_TARGETS={"/treetop-test":"http://127.0.0.1:9999","/treetop-production":"http://127.0.0.1:10000"}
```

The proxy map is used by Vite during development and has a runtime equivalent in
the released container. Other production hosts need equivalent same-origin
paths in their web server or ingress. See [Server connections](docs/server-connections.md)
for configuration precedence, reverse-proxy examples, persistence, switching
behavior, and security considerations.

Servers protected by `TREETOP_ACCESS_TOKENS` can be reached either with a per-connection token entered in **Switch server**, or with a server-side proxy credential. Browser-entered tokens are held only in memory and disappear on reload. Development proxy credentials use `TREETOP_PROXY_ACCESS_TOKEN` or `TREETOP_PROXY_ACCESS_TOKENS`; never put a credential in a `VITE_*` variable.

## Using the workbench

The [user guide](docs/user-guide.md) describes the Playground, Policies, Schema, System, and Metrics pages, including schema-free behavior and policy lookup semantics.

The Metrics page fetches the Prometheus endpoint when opened and visualizes request volume, HTTP and policy-evaluation latency, and allow/deny decisions. It does not poll automatically; use **Refresh** for a new snapshot or **Raw** to inspect the original exposition.

## Demo environments

Start the released server and frontend together with one of the bundled Cedar environments:

```bash
npm run demo:list
npm run demo -- documents
npm run demo -- dns
npm run demo -- change-control
npm run demo -- schema-free
```

The first run downloads and caches the official v0.0.12 Linux server binary. Schema-backed environments use typed guided forms; the schema-free environment infers its basic choices from policy scopes. Each includes suggested allow/deny requests. See [Demo environments](demo/README.md) for provenance, Docker startup, port overrides, and adding environments.

## API contract

The checked-in TypeScript contract targets the `treetop-rest` v0.0.12 OpenAPI document, which includes the optional Bearer-token admission contract:

```bash
npm run api:generate
```

To target another ref or a running server:

```bash
TREETOP_REST_REF=main npm run api:generate
TREETOP_OPENAPI_URL=http://127.0.0.1:9999/openapi.json npm run api:generate
```

`npm run api:check` regenerates the v0.0.12 contract and fails if the checked-in client has drifted.

## Tests

```bash
npm test
npm run lint
npm run build
npm run test:e2e:install
npm run test:e2e
npm run test:e2e:live
npm run test:demos
```

- `test:e2e` runs browser scenarios with a mocked REST boundary, including server-profile persistence and switching.
- `test:e2e:live` downloads the official Linux v0.0.12 server, loads real Cedar policy/schema fixtures with both upload and Bearer credentials, and runs the primary authorization flow through Vite's same-origin proxy. Set `TREETOP_REST_VERSION` to exercise another release or `TREETOP_SERVER_BIN` to use a local build.
- `test:demos` validates every advertised demo decision and principal lookup against the released server.

## Releases

Pushing a semantic version tag such as `v0.1.0` runs unit, lint, and production
build verification; publishes `linux/amd64` and `linux/arm64` image manifests to
GHCR; updates `latest` for stable versions; and creates or updates a GitHub
Release with a `dist` tarball and SHA-256 checksum. The image is also tagged with
the original Git tag and the equivalent semantic versions.

GHCR creates a new package as private by default. After the first tagged
workflow succeeds, a package administrator must make the package public once in
GitHub's package settings so unauthenticated Docker and Podman pulls work.
