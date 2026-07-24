# Imports & migration

How data gets **into** RetireGolden without retyping — and the posture behind it: manual entry is the
deliberate design, so the import surface attacks exactly the entry friction that costs adoption
(migrants from other tools, balances sitting in broker CSVs, and the single richest seed document,
last year's Form 1040). Everything here is client-side: files the user already has, parsed in the
browser, nothing transmitted. Portability **out** is the companion contract in
[plan-file-format.md](plan-file-format.md).

Code: `packages/planner-ui/src/import/` (pure mappers + wizard UI), `packages/planner-ui/src/planner/sections/UpdateBalancesPanel.tsx`
(account editor hook). Shipped by the `onboarding-import-and-migration` plan (private planning docs).

## The wizard (`/import`)

Reached from the planner home's "Import from a file" getting-started card. Four guided paths, each
producing a **draft plan** through the same validated route as backup import (`parsePlan` /
`migratePlanToCurrent`), previewed behind a shared **review checklist** before anything is saved.

The checklist is the honesty mechanism (nothing imports silently). Every item is one of:

- **Imported** — mapped directly from the source.
- **Assumed — review** — a default the mapper had to invent (e.g. missing cost basis treated as
  basis = balance), stated so the user can correct it.
- **Not imported — add by hand** — things the source cannot express, with a pointer at the right
  planner screen.
- **Skipped** — unreadable/junk rows, each named.

## Sources

### Broker positions CSV (Schwab, Fidelity, Vanguard) — `brokerCsv.ts`

Version-sniffs the customer-facing positions/holdings download by header shape (Schwab
"Positions for account …" sections; Fidelity account-number/current-value columns; Vanguard
holdings + transactions download, stopping at the transactions section). Produces per-account
balance aggregates plus cost basis where the file carries it (Vanguard's holdings file has none —
reported as unmapped). Two consumers:

- **New plan:** account types guessed from the account label (Roth/IRA/401(k)/HSA keywords, else
  taxable), every guess a review item.
- **Update balances** (returning users, the annual-checkup posture): the Accounts screen's
  "Update balances from a broker CSV" panel parses the same file and reconciles it against the
  plan the user already built — matching each file account to a plan account, previewing the exact
  before→after change, and applying only `balance` (and `costBasis` on taxable/equity-comp). This
  reconciliation model is its own section — [Refresh & reconciliation](#refresh--reconciliation) below.

Unknown header shapes are refused with a pointer at the spreadsheet import — never guessed at.

### ProjectionLab JSON export — `projectionLab.ts`

Maps the user-accessible JSON data export (sniffed by its `currentFinances.accounts` shape):
accounts by type keyword (cash/taxable/traditional/roth/HSA/property/debt; unknown types like
crypto are reported unmapped, not guessed), wages-like income to a wages stream, other income to
recurring ordinary income, expenses summed into baseline spending, the birth year, and a
retirement milestone age. Social Security is deliberately deferred to the SS screen (a claim
setup, not a dollar figure). Strategies/assumptions/scenarios never transfer — stated on the
checklist. Format drift fails with a helpful message.

### Generic spreadsheet / RPM CSV — `genericCsv.ts`

For everything else, including the Bogleheads Retiree Portfolio Model saved as CSV. Two-phase:
`analyzeGenericCsv` finds the header row past title junk and guesses a role per column (name /
type / balance / cost basis / contribution / ignore); the wizard shows the first rows and lets the
user correct the roles; then rows map to accounts (type from the type column, else name keywords,
else taxable-with-review-item). Negative or unreadable balances are skipped items, never data.

### 1040 guided seed — `tenForty.ts`

"Start from your tax return": the user types ~12 line values (filing status, state, DOBs, lines
1a, 2a, 2b, 3a, 3b, 4b, 5b, 6a, 7, 11) — guided entry only, **no PDF parsing/OCR in v1**
(explicitly deferred). Mapping:

- Header → filing status, state; DOBs anchor the household (MFJ adds the spouse).
- 1a wages → a wages stream (joint wages land on the primary with a split-it-yourself note).
- 2b + 3b interest/dividends → an **estimated** taxable account sized at a 2.5% combined yield
  (`ASSUMED_TAXABLE_YIELD_PCT`), with the qualified ratio from 3a/3b — flagged as an estimate to
  replace with the real balance.
- 4b IRA distributions → unmapped pointer (withdrawals are modeled from balances, not history).
- 5b pensions → a pension account paying that amount monthly starting now (COLA/survivor defaults
  flagged).
- 6a SS benefits → a benefit basis with the claim-at-FRA simplification, flagged.
- 11 + 2a → `assumptions.recentAnnualMagi` (the IRMAA two-year lookback).
- Line 7 → guidance only (a loss points at the capital-loss-carryforward field).

Every prefilled value carries a "From your 1040 — line N" review item and is ordinary editable
plan data afterward.

## Refresh & reconciliation

New-plan imports build a plan from nothing; the **Update balances** panel does the harder, returning-user
job — folding a fresh broker download into a plan the user has already tuned (allocation, yields,
contribution schedule, beneficiaries) — without disturbing any of that work. That reconciliation model
is a pure, browser-free engine, `packages/planner-ui/src/import/refresh.ts`, published on the
stability-promised `@retiregolden/planner-ui/import-refresh` subpath so the Pro/Advisor repo can drive
the same match-and-apply headless. The panel is a thin view over it.

**Match classification, not source fidelity.** `classifyRefresh` scores each file account against the
plan's balance-updatable accounts (property, debt, pension, annuity are never refresh targets) and grades
the match on a four-way scale of *certainty about which plan account a row refers to*:

- **`exact`** — one plan account whose whole (normalized) name appears in the file label. Defaults ON.
- **`likely`** — one plan account sharing a distinctive word with the label. Defaults ON.
- **`ambiguous`** — more than one plausible plan account (e.g. "Roth IRA" and "Rollover IRA" both share
  "ira"); the runners-up are recorded in `alternativeAccountIds` as a false-positive audit trail and the
  row defaults **OFF** — the engine refuses to guess between them.
- **`unmatched`** — no plausible plan account. Defaults OFF; the user assigns it by hand.

This is a **different axis from the import-provenance `ImportConfidence`** (below), and deliberately not
the same enum: `RefreshMatchKind` grades *which account*, `ImportConfidence` grades *how faithfully the
dollar amount survived the trip*. A row can be an `exact` match to a summed (`derived`) aggregate, or an
`ambiguous` match to a verbatim single position — collapsing the two scales would let the UI equate "we're
sure this is your Roth" with "we copied this number exactly." The two ride together on each landed value,
never merged.

**Stale and duplicate suggestions — never auto-merged.** `buildRefreshDelta` surfaces two reconciliation
hints the panel shows but never acts on by itself:

- **Stale accounts** — updatable plan accounts that *no* file row matched (their balances are drifting out
  of date). An informational note, not a blocker.
- **Duplicate collisions** — two or more selected file rows resolving to one plan account. These are
  **suggestions that block apply**, never silent merges: the callout names the collision, Apply disables,
  and the engine writes nothing for that account until the user re-points one of the rows. The panel never
  sums two file rows into one plan account on its own.

**The before→after preview cannot diverge from apply.** The panel derives the delta from the live
selection every render and shows, per row, the account's current balance → its refreshed value (plus a
`basis before → after` line when the file carried cost basis, and a "(clamped to $0)" note when a negative
file value clamped). This preview is computed by running the *same* write primitive apply will use, on a
shallow per-account copy of the plan's accounts (`{ ...account }`) — sufficient because the refresh only
ever assigns the top-level `balance`/`costBasis` primitives and never reaches into an account's nested
strategy objects, so those stay shared with the live plan while the copied primitives absorb the writes.
What the user sees is structurally the writes that will happen, not a re-derived guess.

**The structural guarantee: a balance refresh cannot overwrite unrelated strategy assumptions.** This is
the whole point of the panel and is enforced by construction, not by discipline. `applyRefresh` mutates
the draft only through one internal primitive that delegates to the existing `applyBrokerBalance` — the
single spread-only helper that names *only* `balance` and (on taxable/equity-comp) `costBasis` — and
copies back only those two fields, in place. It never assigns a whole account shape and never touches any
other collection, so a refresh physically cannot rewrite an allocation, a yield, a contribution schedule,
or any other field the returning user set. Selected, non-protected, non-duplicate accounts are the only
things it can write; protected and duplicate-collision targets are skipped entirely, not partially applied.
Apply routes through the store's `update((d) => applyRefresh(d, delta, selection))` seam, so `parsePlan`
still gates the save exactly as every other edit does.

**The `protectedTargets` contract.** `classifyRefresh` / `buildRefreshDelta` / `applyRefresh` all accept a
caller-supplied set of plan paths (`accounts[i]` or `accounts[i].balance`) that are off-limits: a candidate
whose target is protected is classified but defaults OFF and is skipped on apply, never partially written.
The engine never invents a protected set of its own — the seam is the argument. The **Free web panel passes
none** (every updatable account is fair game); the Advisor workbench feeds it the intake decisions from the
Pro repo in a later dispatch, so an advisor can freeze the accounts they've reconciled by hand while letting
the rest refresh.

**The protection seam into the embedded panel.** The engine takes positional `protectedTargets`, but the
embedded `UpdateBalancesPanel` takes no props — so hosts feed protection through the ambient
`RefreshProtectionProvider` (exported from the package root, mirroring `PlannerEditionProvider`). The seam
speaks **stable account IDs**, not `accounts[i]` positions: each entry is a whole-account id (`acct-123`) or
an `<accountId>.<field>` (`acct-123.costBasis`). Positions are the wrong currency here because plan-array
indices shift as accounts are added or removed in the workspace, so a stored positional path would silently
start protecting the wrong account; IDs are stable, and the professional host resolves its stored
draft-relative paths to IDs once at approve time instead of re-reconciling indices forever. Because engine
account ids are arbitrary nonempty strings that may themselves contain dots (`broker.acct-123` is a valid id),
the panel decodes each entry against the **live plan** — an exact match to a plan account id is a whole-account
entry, otherwise the *longest* plan account id whose `` `${id}.` `` prefixes the entry names the account and the
remainder is the field — never by splitting at the first dot. The panel maps each protected id to that account's
**current** index fresh on every render and emits the `accounts[i]` / `accounts[i].<field>` paths the engine's
`protectedTargets` contract expects (ids absent from the plan are skipped). The public app renders no provider
and the panel gets an empty set (every account is fair game, unchanged behaviour).

**Field-scoped entries are conservative today: they block the account's whole refresh.** An `<accountId>.<field>`
entry currently locks the *entire* account's refresh write, not just the named field — the engine's
`applyBrokerBalance` writes balance and cost basis as a unit and cannot skip one field, so `isProtectedPath`
treats a protected descendant as locking the account (protection errs toward overwriting *less*). So
`acct-123.costBasis` protects `acct-123`'s balance too. The `<accountId>.<field>` form is accepted so a host can
record the intended granularity; finer per-field application is future engine work and will not change what
hosts pass.

Protected accounts stay **selectable** in every row (marked "(protected)"); selecting one **blocks** that row —
a "Protected — advisor override" note and a small **Allow this refresh** control — rather than being refused, so
even an unmatched row (or one guessed elsewhere) has a path to deliberately refresh a frozen account. A blocked
row contributes nothing to the preview/apply until released. That control is deliberately *transient* and
**row-scoped**: it releases the account for that panel instance only, and only for the row that asked. Release
is tracked as `account id → the requesting row's index`, so the released account is subtracted from the
effective set the panel re-classifies against — while every *other* row that selects it stays blocked with the
note (one releasing row per account) and, defensively, a sibling's selection of it is dropped before
preview/apply (a belt against DOM tampering). Releasing row *k* for account *A* therefore never unlocks *A* in a
sibling row. It is **not** a stored re-decision, the advisor's override record stays immutable after approve,
and releases clear whenever a new file is parsed.

The refresh emits an honesty checklist compatible with `reviewToProvenance` (landed values carry an
`ImportConfidence` — `derived` for a summed aggregate, `exact` for a lone verbatim position — and a target
plan-path), so a refresh is as auditable downstream as a first-time import.

## Import-provenance contract

The review checklist is the human honesty layer; the **import-provenance contract** is the
machine-readable one underneath it. Every review item a mapper emits now carries, alongside its
`source`/`detail`/`status` strings, a structured **source locator** and a **confidence** grade, so a
downstream tool can answer "where did this value come from, and how sure were we?" without re-parsing
the file. The contract is `packages/planner-ui/src/import/provenance.ts` — deliberately browser-free
(no DOM, no Web Crypto) so a Node process or the Pro/Advisor repo can build and read it. It is
published on the stability-promised `@retiregolden/planner-ui/import-provenance` subpath.

**Source locators** (`SourceLocator`) pin a value to an exact spot in the source, as a small
discriminated union: `csvRow` (row number, optional column), `jsonPath` (a path like
`currentFinances.accounts[7]`), `form1040` (a line like `1a`), `derived` (computed from other
locators — e.g. a per-account balance points at the exact rows it summed), and `none` (an honest "no
precise coordinate" for invented defaults and "everything else" reminders, with a note rather than a
fabricated row). The file name is **not** part of a locator — it lives once at the source level (see
the export below), so a locator stays small and a value fused from two files points at both.

**Confidence** (`ImportConfidence`) grades how faithfully a source value survived the trip into the
plan — a distinct axis from the insights high/medium/low scale (which grades how strong a *finding*
is; the two are deliberately not the same enum):

- **`exact`** — read verbatim from the source (a 1040 wages line, a broker market value).
- **`derived`** — computed from other sourced values (a MAGI summed from two lines).
- **`estimated`** — inferred with a heuristic (the 2.5%-yield taxable balance from interest/dividends).
- **`assumed`** — a mapper default with no source behind it (a guessed account type, a July-1 DOB).
- **`unmapped`** — present in the source but nothing landed (a recognized-but-unmodeled 1040 line).

**Reviewer decisions** (`ReviewerDecision`: `pending` / `accepted` / `overridden` / `rejected`, with
an optional override value and note) are the third, optional field. The free import wizard **never**
sets them — every item stays `pending`; the state exists so the Pro/Advisor review workbench can
record a human's verdict later without a schema change. A fourth optional field, **`target`**, names
the engine plan path a value landed on (`accounts[3]`, `household.state` — the Household Map's
node-source convention) whenever one addressable field or record exists, so a workbench can apply an
override to the right field without parsing English. All these fields are additive and optional on
`ImportReviewItem`, so the checklist and the existing wizard UI are unchanged by their presence.

**The import report** ("Download import report", shown once a draft exists) serializes the whole
picture to a portable JSON envelope via `serializeImportProvenance`, mirroring the plan-format
envelopes: `kind: "retiregolden.import-provenance"`, integer `version: 1`, an `exportedAtIso` stamp,
the `planSchemaVersion`/`engineVersion` current when written, a `sources[]` array, and the review
items split into `mappings` (what landed) and `unresolved` (the add-by-hand list). Each source is an
`ImportSourceRef` — `file`, SHA-256, byte count, and the mapper that read it — and **nothing else**:
the report identifies a source by hash, it **never embeds the raw document**, which is exactly what
makes it safe to hand off (it carries provenance, not the 1040 PDF it describes). The hash is of the
file's **raw bytes** (decoding first would normalize BOMs out of the digest), so it matches
`sha256sum` on the original; on a host without Web Crypto it degrades to an empty string — never a
wrong hash — and the import still completes. The guided 1040 path publishes **no** hash at all
(empty string): its typed inputs are low-entropy personal data, and a deterministic fingerprint in a
handoff report would be dictionary-attackable. Hashing is the one piece that needs `crypto.subtle`, so
it lives in the sibling `sourceHash.ts` (`digestSource`, async) and is called only at the async UI
boundary in `ImportPage.tsx`; the mappers stay synchronous and pure. `parseImportProvenance` reads
the envelope back with a named-reason result union (`too_large`, `not_json`, `wrong_kind`,
`unsupported_version`, `malformed`) — every source, entry, locator, confidence, and decision field is
shape-checked before the typed result exists (hash format, non-negative integer byte counts,
source-index bounds, `overrideValue` exactly when a decision is `overridden`, and a bounded
derived-locator depth), while unknown top-level fields stay tolerated so a host may extend it. The
serializer writes only the contract's fields, so a caller extension can never smuggle document
content into a report. The report bundles the single source per guided path today; the `sources[]` array
supports multi-source fusion, and leaf locators carry an optional `sourceIndex` naming their entry in
it (omitted means the first source), when a future path needs it.

## Security posture

Imported files are hostile input, same discipline as the SSA statement XML parser: a hardened
RFC-4180 CSV core (`csv.ts`) with size/row/column caps and no exceptions on malformed text; every
number through `parseMoney` (junk → explicit skip, magnitude cap); JSON size caps; formula-looking
and markup-looking strings stay inert data (never evaluated or rendered as markup). Adversarial
suites live beside each mapper (`*.test.ts`).

## Learning Center

`moving-to-retiregolden` and `seed-your-plan-from-your-tax-return` (Using RetireGolden), wired to
`/import` and the accounts/income screens.
