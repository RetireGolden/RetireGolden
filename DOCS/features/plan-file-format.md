# The plan file format (JSON export contract)

RetireGolden's answer to lock-in fear is a documented, versioned, plain-JSON export. This page is the
contract: what the file contains, what stays stable, and what the app guarantees when it reads one back.
It backs the app's public sustainability and data-portability commitments and is
enforced by tests (`app/src/data/v2Backup.roundtrip.test.ts`, `app/src/data/v2Backup.test.ts`,
`app/src/engine/model/migrations.test.ts`, and the docs-consistency suite).

## The envelope

**Download plan backup** on the planner home produces one JSON file holding every user plan:

```json
{
  "kind": "retiregolden.v2.backup",
  "backupVersion": 1,
  "exportedAtIso": "2026-07-08T12:00:00.000Z",
  "plans": [ { "schemaVersion": 1, "id": "…", "name": "…", "…": "…" } ]
}
```

- `kind` — file discriminator. `retiregolden.v2.backup` is current; the pre-rebrand
  `retiremint.v2.backup` and `retirecalc.v2.backup` kinds are accepted on import forever.
- `backupVersion` — envelope layout version, currently **1**. A file with an unknown
  `backupVersion` is refused with a clear message rather than guessed at.
- `exportedAtIso` — informational timestamp; never used for logic.
- `plans` — an array of plan objects. Each plan is self-describing: it carries its own
  `schemaVersion` and is validated and migrated **individually**, so one corrupt entry never
  poisons the rest of the file (bad entries are skipped with a per-plan warning).

Imports over 10,000,000 characters are refused (`MAX_BACKUP_JSON_CHARS`) — a guard against
selecting the wrong (huge) file, not a practical limit on plans.

## The plan object

A plan is the complete household model: `household` (people, filing status, state, moves),
`accounts`, `insurance`, `careEvents`, `incomes`, `expenses`, `strategies`, `assumptions`, and
`scenarios`. The single source of truth for every field is the Zod schema in
[`app/src/engine/model/plan.ts`](../../app/src/engine/model/plan.ts) — the same schema validates
IndexedDB reads, JSON imports, and migration output, so there is no separate (drifting) file spec.
Field-level semantics are documented inline on the schema as doc comments.

`schemaVersion` is currently **1**.

## Stability guarantees

1. **Old exports import forward, forever.** Every persisted or imported plan passes through
   `migratePlanToCurrent` (`app/src/engine/model/migrations.ts`). When the schema version bumps,
   a pure `fromVersion → fromVersion+1` step is registered and covered by a fixture test, so a
   backup written by any past version of the app migrates step-by-step to current. A pinned
   full-featured v1 export lives in the round-trip test suite and must stay importable — CI fails
   if a schema change would strand it.
2. **Most growth never bumps the version.** New features land as optional fields with no-op
   defaults (the additive-with-defaults discipline documented in
   [DOCS/standards.md](../standards.md)), so a v1 file written in June still validates unchanged
   in December. Version bumps are reserved for genuine reshapes.
3. **Newer files are refused, never "fixed".** A plan whose `schemaVersion` is above what the app
   knows is skipped with a warning (`newer_than_app`) — the app will not destructively rewrite a
   file from a future build.
4. **Validate before replace.** Import parses and validates the whole file before anything is
   written; a file that fails validation changes nothing.
5. **Round trip is exact.** Export → import restores each plan's content byte-for-byte, with two
   deliberate normalizations on import: plans get `origin: "user"` (library demos become yours),
   and a plan whose `id` collides with an existing plan (or a reserved `example:*` id) is re-keyed
   to a fresh id. Nothing else is rewritten.
6. **Unknown fields are dropped, not errors.** Hand-added or third-party keys the schema doesn't
   know are stripped during validation. Round-tripping a file through the app keeps everything the
   schema defines and only that.
7. **Plain data, no code.** The file is inert JSON. Strings are stored and re-exported as data —
   the import path never evaluates or renders them as markup (adversarially tested).

## What the file is not

- Not encrypted and not anonymized — it is your full plan in the clear. Treat it like the
  financial document it is.
- Not a report. Human-readable summaries live in the report/CSV exports; this file is for
  restore, migration between devices, and portability out.

## Reading the format from other tools

Third-party tools (or your own scripts) can read a backup with ordinary JSON tooling: filter
`plans[]`, and treat `schemaVersion` as the compatibility key. Writing files RetireGolden imports is
equally supported: emit the envelope above with plans that satisfy the current schema — the import
path gives field-by-field validation errors on anything malformed. The in-app import wizards
(`app/src/import/`) produce plans through exactly this route.
