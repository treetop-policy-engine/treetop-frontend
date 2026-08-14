# Server connections

Treetop Workbench talks to one `treetop-rest` server at a time. A connection identifies an API base URL and a human-readable name such as **Test** or **Production**. Policies, schemas, labels, metrics, and authorization decisions always come from the active server.

Switching connections does not upload data, alter a server, or combine information from two environments.

## Configure connections at startup

For one server, use the backwards-compatible variables:

```dotenv
VITE_TREETOP_API_URL=/treetop-api
VITE_TREETOP_PROXY_TARGET=http://127.0.0.1:9999
```

For multiple servers, set `VITE_TREETOP_SERVER_PROFILES` to a JSON object:

```dotenv
VITE_TREETOP_SERVER_PROFILES={"defaultServer":"test","servers":[{"id":"test","name":"Test","url":"/treetop-test"},{"id":"staging","name":"Staging","url":"/treetop-staging"},{"id":"production","name":"Production","url":"/treetop-production"}]}
```

Each server has:

- `id`: a stable identifier used for the saved active selection;
- `name`: the label shown in the workbench; and
- `url`: an absolute API URL or a path on the frontend origin.

`defaultServer` is optional. It is used on a browser's first visit; a valid selection already saved in that browser takes precedence. The JSON may also be an array of server objects when no explicit default is needed.

These `VITE_` values are public frontend configuration. Vite reads them when the
development server starts and embeds them when a production bundle is built.
The released container accepts equivalent runtime variables without the
`VITE_` prefix: `TREETOP_API_URL`, `TREETOP_SERVER_PROFILES`, and
`TREETOP_ACTIVE_SERVER`. Runtime values take precedence over build-time values.
Never put credentials, upload tokens, or other secrets in a profile. See
[Container and static deployment](deployment.md) for the container proxy
variables and examples.

## Browser access tokens

Select any configured or browser-managed server to set, replace, or clear its Bearer access token. The password field is always empty when opened; the UI reports only whether a token is configured. Credentials are kept in a separate in-memory map and are never added to `ServerProfile`, local storage, profile JSON, URLs, generated configuration, error text, or analytics.

A browser credential is cleared when the page reloads, the credential is explicitly cleared, the server is deleted, its URL changes, or the server rejects it with `401 Unauthorized`. A `401` opens a credential-focused recovery path without retaining or displaying the rejected value.

Bearer authorization is sent only to `/api/v1/**` and `/metrics`. Liveness, readiness, and OpenAPI requests remain credential-free. The browser refuses to hold a token for plaintext HTTP outside loopback. For a relative proxy path, the frontend page's own origin determines transport security, so an insecure non-loopback page is also rejected.

## Development proxy

The Vite development server always maps `/treetop-api` to `VITE_TREETOP_PROXY_TARGET`. Multiple same-origin paths can be mapped with `VITE_TREETOP_PROXY_TARGETS`:

```dotenv
VITE_TREETOP_PROXY_TARGETS={"/treetop-test":"http://127.0.0.1:9999","/treetop-staging":"http://127.0.0.1:10000","/treetop-production":"http://127.0.0.1:10001"}
```

The path prefix is removed before forwarding. For example, `/treetop-test/api/v1/status` is sent to `http://127.0.0.1:9999/api/v1/status`.

The development proxy, and the released container's equivalent runtime proxy,
can inject a shared server-side credential without exposing it to browser code:

```dotenv
TREETOP_PROXY_ACCESS_TOKEN=deployment-default-token
TREETOP_PROXY_ACCESS_TOKENS={"/treetop-test":"test-deployment-token","/treetop-production":"production-deployment-token"}
```

The JSON map overrides the default token for matching proxy prefixes. Vite parses both variables only in `vite.config.ts`, fails startup on malformed configuration without printing values, and injects or replaces `Authorization` only for protected upstream paths. These variables deliberately do not have a `VITE_` prefix. A proxy-injected token is shared deployment authority: anyone able to use the proxy inherits it.

## Production reverse proxy

Same-origin paths avoid browser CORS restrictions and keep deployment topology out of the frontend bundle. Configure the equivalent routes in an ingress or web server. A representative nginx configuration is:

```nginx
location /treetop-test/ {
    proxy_pass http://treetop-test:9999/;
}

location /treetop-test/api/v1/ {
    proxy_set_header Authorization "Bearer ${TREETOP_TEST_ACCESS_TOKEN}";
    proxy_pass http://treetop-test:9999/api/v1/;
}

location = /treetop-test/metrics {
    proxy_set_header Authorization "Bearer ${TREETOP_TEST_ACCESS_TOKEN}";
    proxy_pass http://treetop-test:9999/metrics;
}

location /treetop-production/ {
    proxy_pass http://treetop-production:9999/;
}
```

Treat this as a schematic: inject secrets through the ingress's protected secret mechanism, not a public frontend file or literal committed configuration. Preserve the trailing slash pairing so nginx removes the connection prefix. Forwarding, TLS, authentication, and network policy remain deployment responsibilities.

Direct cross-origin HTTPS URLs also work when the target server and every intermediary explicitly permit the frontend origin, methods, and the `Authorization` header through CORS. Browser access should not be confused with the server's client-IP allowlist; both layers may need configuration.

## Add and switch servers in the UI

Open **Switch server** in the sidebar or **Servers** on the System page.

1. Select a saved server and choose **Connect**.
2. Choose **New** to save another name and URL in this browser.
3. Browser-added entries can be edited or removed. Startup-configured entries are read-only.
4. Credentials can be changed for either kind of entry without making startup-configured names or URLs editable.
5. The active entry cannot be removed; connect to another server first.

The workbench clears the previous in-memory snapshot when it switches. It then requests status, version, and schema from the selected server. Policies and metrics are fetched by their pages as needed. Responses still in flight from an earlier server are ignored.

Connection selection and browser-added profiles are stored under `treetop.serverProfiles.v1` in local storage. Existing installations using the earlier `treetop.baseUrl` key are migrated automatically. Clearing site data restores the configured default and removes browser-added entries.

## Failure behavior

Selecting an unavailable server leaves that connection active and shows it as disconnected. Open the switcher to reconnect, correct a browser-managed URL, or select another environment. A failed connection never silently falls back to another server; that could make test and production results difficult to distinguish.

Operational status comes from the selected server:

- `/livez` verifies that an HTTP worker is alive;
- `/readyz` verifies that configured server-side sources have completed their initial valid load; and
- `/api/v1/status` identifies policy, schema, labels, validation mode, and runtime limits.

## Security model

- Profiles contain endpoints only, never secrets.
- Browser-held tokens are ephemeral; password managers and browser extensions remain outside the workbench's control.
- Browser-added profiles are local to that browser profile and are not synchronized by the workbench.
- Treat production connections and proxy-injected shared credentials as production access. Cedar still makes application authorization decisions after admission succeeds.
- Prefer HTTPS and a same-origin reverse proxy outside local development.
- Use conspicuous, distinct names for environments; avoid two profiles with the same name.
