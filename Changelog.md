# Changelog

## [0.1.0] - 2026-09-06

### Breaking changes

- Adopt REST 0.1.0 and declared `(resource_type, attribute)` label ownership.
  Update guided fields, demos, generated API, and reproducible release source builds.
- Require current status and policy versions. Reject old label syntax, duplicate
  targets, malformed batch responses, and numeric metadata that would lose
  precision in JavaScript. Remove unlimited-limit and omitted-generation display.
- Remove the retired single-server storage migration and historical binary
  selector. See [MIGRATION.md](MIGRATION.md) for configuration and format 2 bundles.
