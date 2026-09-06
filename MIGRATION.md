# Breaking frontend 0.1.0 migration

Upgrade the workbench and REST to the coordinated 0.1.0 contract. Early releases
prioritize correctness over compatibility. The generated API comes from the
immutable REST candidate in `scripts/lib/treetop-contract.mjs`.

## Declared targets

Label rules now declare one exact resource type and attribute:

```json
{
  "target": {"resource_type": "DNS::Host", "attribute": "nameLabels"},
  "field": "name",
  "patterns": [{"name": "prod", "regex": "^prod"}]
}
```

Guided forms exclude attributes owned on the exact selected Cedar type. Equal
attribute names on other types are independent. Old `kind`/`output` rules and
duplicate ownership are rejected before metadata enters the workspace. Core and
Bundle own Cedar validation and label application; the UI reads their declared
scope for presentation. Constrain resource types before trusting derived labels.

Migrate bundle/module manifests to format 2, rebuild archives, and re-sign.
All included demos use the new syntax and verify their advertised decisions
against the same candidate server.

## Current metadata and responses

The UI requires complete status capabilities and policy versions with `hash`,
`loaded_at`, nullable `label_set`, and `generation`. Missing batch limits no longer
appear as unlimited. Zero is an explicit limit. Schema revisions are distinct
hash/timestamp objects. Server version strings report package versions.

Authorization responses must match submitted counts, positions, and IDs; include
consistent versions and decisions; and provide the correct permit ID or array.
Malformed responses show an error. JavaScript cannot represent every u64 exactly:
integer metadata outside its safe range is rejected instead of silently rounding.

The retired `treetop.baseUrl` storage key is ignored. Configure current server
profiles again if you previously used only that key. Current stored profiles are
unchanged.

## Candidate builds

Demo and live-test scripts build the exact source revision with `cargo --locked`;
old release-download selection is removed. `TREETOP_SERVER_BIN` accepts an explicit
local executable. The Docker demo builds the same revision. Source builds require
Git and Rust. After approval, release Core, Bundle, and REST before the frontend.
Do not merge, tag, or publish before user approval.
