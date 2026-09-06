# Repository guidelines

Prioritize correctness and one strict project contract over compatibility in early
releases. Remove obsolete aliases and defaults with explicit migration notes.
Core/Bundle own authorization and Cedar validation; never infer authorization from
policy listings or duplicate their evaluators in the UI.

Generate API types from the immutable REST revision in
`scripts/lib/treetop-contract.mjs`; do not hand-edit generated declarations.
Validate response metadata and batch correspondence before presenting decisions.
Match label declarations to exact resource types. Keep credentials out of browser
storage, request URLs, error output, and public probe requests.

Run `npm ci`, `npm run api:generate`, `npm run lint`, `npm test`, `npm run build`,
`npm run test:e2e`, `npm run test:e2e:live`, and `npm run test:demos`. Review the API
diff and verify deterministic regeneration. Keep container CI and all browser
checks enabled. Document breaking changes in `Changelog.md` and `MIGRATION.md`.
Use signed commits and do not merge or publish before user approval.
