# Changelog

## [Unreleased]

### Changed

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
