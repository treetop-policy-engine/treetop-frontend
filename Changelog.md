# Changelog

## [Unreleased]

## [0.2.0] - 2026-10-03

### Changed

- Refresh compatible frontend dependencies and Action pins, including Vite 8.3.2,
  Vitest 5.0.3, ESLint 10.12.0, and current icon, DOM, and TypeScript lint tooling.
  Keep TypeScript 5.9 for the API generator's declared peer dependency.

- Pin API generation, live/demo verification, and Docker demos to the REST
  revision using Core/Bundle 0.3.0 and Utoipa 6. Regenerate TypeScript declarations
  from that exact OpenAPI document. Authorization JSON and strict response
  validation are unchanged; archive users must rebuild and re-sign with Bundle
  CLI 0.3.0. See [MIGRATION.md](MIGRATION.md) for archive migration guidance.

- Update React to 19.3, Vite to 8.3, Vitest to 5, jsdom to 30, Playwright to
  1.63, and the remaining supported runtime and development dependencies.
- Refresh all transitive dependencies and pinned GitHub Actions. TypeScript
  remains on 5.9 because the current OpenAPI generator requires TypeScript 5.

### Breaking changes

- Require Node.js 22.22.2+, 24.15.0+, or 26+ for development; Node.js 23 and 25
  are unsupported by the updated test tooling. Use a supported Node.js release
  before running `npm ci`.

## [0.1.0] - 2026-09-06

### Breaking changes

- Adopt REST 0.1.0 and declared `(resource_type, attribute)` label ownership.
  Update guided fields, demos, generated API, and reproducible release source builds.
- Require current status and policy versions. Reject old label syntax, duplicate
  targets, malformed batch responses, and numeric metadata that would lose
  precision in JavaScript. Remove unlimited-limit and omitted-generation display.
- Remove the retired single-server storage migration and historical binary
  selector. See [MIGRATION.md](MIGRATION.md) for configuration and format 2 bundles.
