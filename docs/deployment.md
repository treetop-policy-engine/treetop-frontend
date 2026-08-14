# Container and static deployment

Treetop Workbench is a static browser application. Tagged releases provide two
ways to deploy the same production build:

- `ghcr.io/treetop-policy-engine/treetop-frontend:<version>` is an Alpine-based,
  multi-architecture OCI image for Docker, Podman, Kubernetes, and other OCI
  runtimes.
- `treetop-workbench-<version>.tar.gz` is a portable static bundle attached to
  the GitHub Release, alongside its SHA-256 checksum.

Use an immutable version tag or digest for production. `latest` is convenient
for evaluation but moves whenever a new release is published.

GitHub Container Registry creates a package as private on its first publish. A
package administrator must change the package visibility to public once before
users can pull it anonymously. This is a GitHub package setting, not something a
container tag can control.

## Run the container

The image listens on port 8080 and runs as the unprivileged `nginx` user. To
connect directly to a Treetop server that permits browser cross-origin requests:

```bash
docker run --rm --name treetop-workbench \
  -p 8080:8080 \
  -e TREETOP_API_URL=https://treetop.example.com \
  ghcr.io/treetop-policy-engine/treetop-frontend:v0.1.0
```

Replace `docker` with `podman` to use Podman.

For the usual same-origin arrangement, attach both containers to one network and
refer to the server by its container or Compose service name:

```bash
docker run --rm --name treetop-workbench \
  --network treetop \
  -p 8080:8080 \
  -e TREETOP_PROXY_TARGET=http://treetop-rest:9999 \
  ghcr.io/treetop-policy-engine/treetop-frontend:v0.1.0
```

`localhost` inside this container refers to the frontend container, not the
host or another container.

The writable runtime state is confined to `/tmp`, so a hardened invocation can
use a read-only root filesystem:

```bash
docker run --rm --read-only --tmpfs /tmp:rw,noexec,nosuid,size=16m \
  -p 8080:8080 \
  -e TREETOP_API_URL=https://treetop.example.com \
  ghcr.io/treetop-policy-engine/treetop-frontend:v0.1.0
```

The health check endpoint is `/healthz`.

## Runtime environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `TREETOP_API_URL` | `/treetop-api` | Public URL or same-origin path for the default server. |
| `TREETOP_SERVER_PROFILES` | unset | Public server-profile JSON object or array. |
| `TREETOP_ACTIVE_SERVER` | unset | Initial configured server ID when the profile JSON does not specify `defaultServer`. |
| `TREETOP_PROXY_TARGET` | unset | HTTP(S) upstream for the path in `TREETOP_API_URL`. |
| `TREETOP_PROXY_TARGETS` | `{}` | JSON map of same-origin path prefixes to HTTP(S) upstreams. Explicit map entries override the default target. |
| `TREETOP_PROXY_ACCESS_TOKEN` | unset | Default Bearer credential injected by the proxy for protected upstream endpoints. |
| `TREETOP_PROXY_ACCESS_TOKENS` | `{}` | JSON map of path prefixes to proxy credentials. Per-path values override the default. |

For multiple proxied servers:

```bash
docker run --rm --network treetop -p 8080:8080 \
  -e 'TREETOP_SERVER_PROFILES={"defaultServer":"test","servers":[{"id":"test","name":"Test","url":"/treetop-test"},{"id":"production","name":"Production","url":"/treetop-production"}]}' \
  -e 'TREETOP_PROXY_TARGETS={"/treetop-test":"http://treetop-test:9999","/treetop-production":"http://treetop-production:9999"}' \
  ghcr.io/treetop-policy-engine/treetop-frontend:v0.1.0
```

The image validates proxy paths, upstream URLs, JSON, and token character sets
before nginx starts. Public settings are written to `/config.js` and are visible
to every browser user. Proxy access tokens are written only to the server-side
nginx configuration in `/tmp`; they are not included in browser configuration.
As with any environment-based secret, someone with permission to inspect the
container may still read it.

The proxy removes each configured path prefix before forwarding. Shared proxy
credentials are injected only for `/api/v1`, `/api/v1/**`, and `/metrics` below
that prefix. Browser-provided per-connection credentials continue to work when
no shared proxy credential is configured.

## Serve the static archive

Download the tarball and checksum from the matching GitHub Release, verify it,
then extract it into an nginx, Caddy, Apache, object-storage, or CDN document
root:

```bash
sha256sum --check treetop-workbench-v0.1.0.tar.gz.sha256
mkdir treetop-workbench
tar --extract --gzip --file treetop-workbench-v0.1.0.tar.gz \
  --directory treetop-workbench
```

Before serving the files, replace `config.js` when runtime defaults are needed:

```js
window.__TREETOP_CONFIG__ = Object.freeze({
  apiUrl: "/treetop-api",
  serverProfiles: {
    defaultServer: "production",
    servers: [
      { id: "production", name: "Production", url: "/treetop-api" },
    ],
  },
});
```

Configure the static host to fall back to `index.html` for browser routes and to
serve `config.js` with `Cache-Control: no-store`. A static host does not provide
the container's optional reverse proxy; configure equivalent routes in the web
server or ingress as described in [Server connections](server-connections.md).
