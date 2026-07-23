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
  "Update balances from a broker CSV" panel parses the same file and lets the user assign each
  file account to a plan account; applying sets `balance` (and `costBasis` on taxable/equity-comp).

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
record a human's verdict later without a schema change. All three fields are additive and optional on
`ImportReviewItem`, so the checklist and the existing wizard UI are unchanged by their presence.

**The import report** ("Download import report", shown once a draft exists) serializes the whole
picture to a portable JSON envelope via `serializeImportProvenance`, mirroring the plan-format
envelopes: `kind: "retiregolden.import-provenance"`, integer `version: 1`, an `exportedAtIso` stamp,
the `planSchemaVersion`/`engineVersion` current when written, a `sources[]` array, and the review
items split into `mappings` (what landed) and `unresolved` (the add-by-hand list). Each source is an
`ImportSourceRef` — `file`, SHA-256, byte count, and the mapper that read it — and **nothing else**:
the report identifies a source by hash, it **never embeds the raw document**, which is exactly what
makes it safe to hand off (it carries provenance, not the 1040 PDF it describes). Hashing is the one
piece that needs Web Crypto, so it lives in the sibling `sourceHash.ts` (`digestSource`, async) and is
called only at the async UI boundary in `ImportPage.tsx`; the mappers stay synchronous and pure.
`parseImportProvenance` reads the envelope back with a named-reason result union (`too_large`,
`not_json`, `wrong_kind`, `unsupported_version`), tolerating unknown top-level fields so a host may
extend it. The report bundles the single source per guided path today; the `sources[]` array supports
multi-source fusion when a future path needs it.

## Security posture

Imported files are hostile input, same discipline as the SSA statement XML parser: a hardened
RFC-4180 CSV core (`csv.ts`) with size/row/column caps and no exceptions on malformed text; every
number through `parseMoney` (junk → explicit skip, magnitude cap); JSON size caps; formula-looking
and markup-looking strings stay inert data (never evaluated or rendered as markup). Adversarial
suites live beside each mapper (`*.test.ts`).

## Learning Center

`moving-to-retiregolden` and `seed-your-plan-from-your-tax-return` (Using RetireGolden), wired to
`/import` and the accounts/income screens.
