# The planning record (complete export)

The plan file answers “keep my plans safe / hand one plan to a tool.” The planning record answers
“move or archive **everything**.” It is the complete portable record emitted by RetireGolden-Pro for a
personal library or an Advisor firm's client households. The producer is Pro; this public repository provides
the read and verification contract, not a second writer.

The record includes clients, plans, plan version history, baselines, meeting decisions, intake sessions,
migration batches, tax checklists, CPA memos, rollover reviews, monitoring scans and review queue, annual
reviews, firm profile/templates/packet configurations, record-governance settings, sealed plan records, and
the Advisor governance audit ledger. The ledger records grant, unlock, revoke, rotation, and access events,
with firm-unlock evidence where present.

## Container and trust boundary

A planning record has the `.rgcomplete` extension. It is a store-only (uncompressed) ZIP64 archive: it can
stream, and a standard ZIP tool can extract an individual component without processing the rest of the archive.
It is deliberately plaintext. The destination—an encrypted disk or vault—is the trust boundary, not the
archive format.

RetireGolden-Pro produces it for manual export, rolling backup, and offboarding. The archive is not an
encrypted vault and should be handled like the financial, client, and firm material it contains.

## The manifest

Every archive has a `manifest.json` at its root. It is canonical JSON: object keys are sorted recursively,
arrays remain in order, and the file ends with exactly one trailing LF. Its `manifest.sha256` sidecar contains
exactly this grammar:

```
<64 lowercase hex><two spaces>manifest.json<LF>
```

The format discriminator is `retiregolden.complete-export`; `formatVersion` is currently **1**. The manifest
has these field groups:

- **Identity:** `format`, `formatVersion`, `exportId`, `createdAtUtc`, `app`, and `purpose`. `app` records
  product, version, and platform labels. The current purpose labels are `manual`, `rolling`,
  `offboarding`, and `tabletop`.
- **Snapshot:** `snapshot.generation`, `snapshot.startedAtUtc`, and `snapshot.completedAtUtc` identify the
  source-library generation and the window from which it was read.
- **Plaintext claim:** `plaintext: true` makes the archive's intentional lack of encryption explicit.
- **Components:** every component names its `path`, `mediaType` (`application/json` or
  `application/x-ndjson`), `schema`, `schemaVersion`, `byteLength`, `sha256`, `logicalCount`,
  `restorePolicy`, and `edition`. V1 store schemas use the
  `retiregolden.complete-export.<store>` identifier family; the sealed plan-records component carries its
  own `retiregolden.plan-records` schema. The written edition labels are `free-compatible` and `pro-only`;
  the current restore-policy labels are `insert`, `merge`, `replace-setting`, `evidence-only`, and
  `compatibility-only` (the Free-bridge plans component).
- **Store accounting:** `stores` states which source store was `included`, `excluded`, or `not-present`, with
  component paths, source counts, and reason/detail labels where applicable.
- **Omissions:** `omissions` is the explicit list of data that did not enter the archive, with a store id,
  reason code, and human-readable detail.
- **Totals:** `totals.components` equals the component count; `totals.bytes` equals the sum of component
  `byteLength` values; and `totals.logicalRecords` equals the sum of component `logicalCount` values.
- **Compatibility and limits:** `compatibility` states the Pro and Free bridge claims, while `limits` records
  the producer's resource bounds.

The labels above are documented current producer vocabulary, not closed enums. A reader must accept new
non-empty store ids, schema ids, and label values while continuing to check integrity-bearing fields strictly.

## Integrity verification

Verification does not require RetireGolden software. Extract the archive, verify `manifest.sha256` against
`manifest.json` (for example, `sha256sum -c manifest.sha256` from the extracted directory), then verify each
component's raw stored byte length and SHA-256 against its manifest entry. Finally, check the three totals
equations above. An archive whose sidecar, component digest, length, or totals fail is not a verified planning
record.

JavaScript and TypeScript hosts can use the browser-free
`@retiregolden/planner-ui/complete-export` subpath instead of hand-rolling those checks. Its typed parser
validates the manifest contract; `verifyManifestText` checks the exact sidecar grammar and digest; and
`verifyComponentBytes` checks length before SHA-256. Hashing uses Web Crypto in browsers and Node. A host
without Web Crypto fails loudly rather than reporting an invented digest.

## Deliberately omitted data

The omissions ledger is the redaction model. It is part of the file so an archive reports what it leaves out
and why; secrets and machine-bound keys never enter a portable plaintext archive. V1 records these thirteen
omissions:

| Store or artifact | Reason code | Boundary recorded in the manifest |
| --- | --- | --- |
| `library.db` | `machine-bound` | The encrypted SQLite library, WAL, and journals are machine-bound implementation artifacts. |
| `library-key.bin` | `machine-bound` | The OS-wrapped library key is not needed for portable recovery. |
| OS `safeStorage` material | `secret` | OS-bound Electron safeStorage material stays on the original machine. |
| MCP grants and session state | `secret` | Grants and sessions must be re-established on the destination machine. |
| Connector credentials | `secret` | Access tokens, passwords, and credentials never enter a plaintext backup. |
| Third-party connector configuration | `external` | Connector configuration files are not owned or enumerated by RetireGolden. |
| MCP client-config backups | `secret` | Backup copies can contain credentials. |
| Crash logs | `diagnostic` | They can contain sensitive context and are not required for recovery. |
| Import/export temporary files | `temporary` | Temporary material is removed by cleanup policy. |
| User-selected source documents | `external` | The record contains derived intake and evidence state, not the source documents. |
| Generated PDFs and printed packets | `external` | They are external outputs. |
| OS event logs, filesystem snapshots, and sync history | `external` | They are not controlled by RetireGolden. |
| Telemetry | `not-collected` | RetireGolden-Pro has no telemetry identifiers. |

## Compatibility policy

Store growth is additive: a reader tolerates unknown `storeId` values, schema ids, and label values without a
format bump. It refuses a `formatVersion` higher than the version it understands rather than guessing how to
restore a future archive.

The Free bridge is deliberately narrower. The Free web app does not import a complete-export container. When
present, `portable/plans-v2.json` is exactly the v2 backup envelope documented in
[The plan file format](plan-file-format.md), limited to 10,000,000 characters. `compatibility.free` names
that component, or records why it is absent (for example, `free_plans_component_absent`). The legacy v2
envelope remains the Free interchange format.

## V1 limits

| Limit | V1 value |
| --- | ---: |
| Total stored component bytes | 64 GiB |
| Archive entries | 256 |
| Manifest bytes | 2 MiB |
| One component's stored bytes | 32 GiB |
| One JSONL line | 64 MiB |
| JSON nesting | 64 |

## Edition contract

- **Free:** personal plans travel through the plan file.
- **Pro:** a personal saved library travels through the complete export.
- **Advisor:** client households, version history, workflow records, and the governance ledger travel through
  the same container.

Exports are never entitlement-gated: reads and exports remain available during a lapse.

## Related contracts

The Free plan envelope is documented in [plan-file-format.md](plan-file-format.md). Import source and review
provenance is documented in [imports-and-migration.md](imports-and-migration.md). Sealed plan records ride
inside the planning record as `records/plan-records.json`.
