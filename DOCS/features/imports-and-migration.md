# Imports & migration

How data gets **into** RetireGolden without retyping — and the posture behind it: manual entry is the
deliberate design, so the import surface attacks exactly the entry friction that costs adoption
(migrants from other tools, balances sitting in broker CSVs, and the single richest seed document,
last year's Form 1040). Everything here is client-side: files the user already has, parsed in the
browser, nothing transmitted. Portability **out** is the companion contract in
[plan-file-format.md](plan-file-format.md).

Code: `packages/planner-ui/src/import/` (pure mappers + wizard UI), `packages/planner-ui/src/planner/sections/UpdateBalancesPanel.tsx`
(account editor hook). Shipped by the `onboarding-import-and-migration` plan (private planning docs).

## Web emergency-disable boundary

The static web host mounts the planner shell immediately and resolves `/import-feature.json` with
`cache: 'no-store'` in parallel. File inputs stay unmounted behind a neutral availability-check state until
the result resolves. Only a bounded JSON object whose sole key is `"enabled"` with value `true` enables
file-backed import; a missing, malformed, oversized, non-200, extra-key, or explicit-false response fails
closed. Disabling it
removes the home import card and file inputs from direct `/import`, existing-plan broker CSV refresh, mySSA
XML earnings import, and the FedInvest CSV fallback. Each surface shows an unavailable notice. Building plans
manually, entering earnings by hand, opening existing plans, exports, and RetireGolden backup restore stay
available.

The file is not service-worker-precached and Static Web Apps serves it `no-store`, so redeploying the static
document changes the boundary on the next online page refresh or restart. It cannot retract code from a tab
that is already loaded, and it does not remotely disable import in an installed desktop that remains offline.
The planner package remains host-neutral: `PlannerApp.importEnabled`, `PlannerApp.importResolved`, and
`ImportAvailabilityProvider` carry the generic state; the web host owns how it is obtained.

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

### Duplicate IDs on decision-bearing accounts

Current Plan validation refuses a duplicate account ID when row order could select a persisted
decision or forced-distribution schedule. This includes retirement-action sources and destinations,
pension lump-sum offers or elections, annuity purchases, and duplicate IRA rows whose inherited or
SEPP facts disagree. Older backups and third-party data may therefore require repair before import.

Give each real account a unique ID, keep the decision on the actual account row, and update every
reference to that ID. Do not delete a genuine account merely to satisfy validation. Unreferenced
duplicate balance rows with compatible tax, owner, estate-destination, and forced-distribution facts remain loadable for
compatibility. They form one logical account: facts come from the last row, ID order comes from the
first, and ID-keyed RMD, QCD, need-based withdrawal, aggregate Roth-conversion, Form 8606, and
optimizer consumers use the rows' aggregate capacity and basis. One logical debit or credit is
allocated pro rata across the positive physical rows (with an exact final residual), and the public
`balances[id]` value is the aggregate closing balance.

The physical rows still matter. Contributions, allocation drift/rebalancing, distributed yield,
annual growth, reinvestment, and investable totals visit every row, so different row-level assumptions
remain visible in wealth. Contribution runtime identity and the owned-IRA pre-growth/post-growth
evidence sources include the balance-row index; exact replay validates those physical contribution
chains before aggregating the ID once for Form 8606. The guardrail opening signal counts each balance row
once while retaining its historical exclusion of unassigned cash. The logical mutation layer makes
all that positional wealth reachable through ID-keyed operations; it is a compatibility model, not a
reason to create aliases. The only supported mixed balance/non-balance alias is the exact historical
one-cash/one-property pair; additional rows in that channel fail closed. Pure non-balance duplicates
retain their historical last-row publication semantics when no decision references the ID. Imported
real accounts should always receive unique IDs.

## Sources

### Broker positions CSV (Schwab, Fidelity, Vanguard) — `brokerCsv.ts`

Version-sniffs the customer-facing positions/holdings download by header shape (Schwab
"Positions for account …" sections; Fidelity account-number/current-value columns; Vanguard
holdings + transactions download, stopping at the transactions section). Produces per-account
balance aggregates plus cost basis where the file carries it. Vanguard's holdings file has no
cost basis column; the parser says so with a file-level unmapped notice, and what happens next
depends on the consumer:

- **New plan:** account types guessed from the account label (Roth/IRA/401(k)/HSA keywords, else
  taxable), every guess a review item. A taxable account whose file rows carried no cost basis
  gets basis **set equal to the balance** (no unrealized gain), flagged **Assumed — review** with
  a pointer at the Accounts screen — a stated default, never a silent value.
- **Update balances** (returning users, the annual-checkup posture): the Accounts screen's
  "Update balances from a broker CSV" panel parses the same file and reconciles it against the
  plan the user already built — matching each file account to a plan account, previewing the exact
  before→after change, and applying only `balance` (and `costBasis` on taxable/equity-comp **only
  where the file carried one** — a Vanguard refresh leaves the plan's existing basis untouched).
  This reconciliation model is its own section — [Refresh & reconciliation](#refresh--reconciliation) below.

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
else taxable-with-review-item). Negative or unreadable balances are skipped items, never data. A row
below the header with no dollar value in any column is never dropped in silence (#557), and the
analyzer does not sort them: an account whose amount cell is blank (`I-bonds,`) and a footer
(`Prepared by Chase,`) look the same to it, and a label test would call a fund named "Total Bond
Market" a footer. Every such row is *set aside*, the rows above the header (title lines, a "balances
as of" note) included: the map step counts and lists each by source row and
text cells next to the data-row count, and the draft lists each as a skipped item led by its row
number with a conditional remediation (a note needs nothing; an account with a missing amount can be
entered on the Accounts screen). Row numbers are spreadsheet rows: `parseCsv` reports where each kept
row began (`sourceLines`: blank separator lines count, a line break inside a quoted cell does not, as
in Excel or Sheets), which is what the person sees beside the row, and both the generic and the broker
importers build their `csvRow` locators from it, so a row number means the same thing whichever mapper
produced it. Every list is capped (`MAX_SET_ASIDE_LISTED` on the map step and in failure messages,
`MAX_SET_ASIDE_ITEMS` per-row checklist entries) with an "and N more" tail that adds "(rows a to b)"
only when the rest sit together, and each row preview is bounded twice (`MAX_CELL_PREVIEW_CHARS` per
cell, `MAX_CELLS_PREVIEWED` cells per row, an ellipsis past either), so a sheet of thousands of note
lines, a megabyte cell, or a hundred-column row is still counted without becoming that much DOM. When
nothing maps, the failure message still names the set-aside rows; a sheet whose header has no dollar
value below it fails with a message that names every other row, above the header as well as below,
calling the row a header only when its labels named columns the analyzer recognises.
Every role but `ignore` is single-valued — the mapper reads one column per role — so two columns on
the same role is a mapping error, not a preference: `duplicateColumnRoles` names the clash, the
mapping step warns inline and holds Continue, and `draftPlanFromGenericCsv` refuses the same
mapping rather than reading the first column and dropping the rest.

### 1040 guided seed — `tenForty.ts`

"Start from your tax return": the user types ~12 line values (filing status, state, DOBs, lines
1a, 2a, 2b, 3a, 3b, 4b, 5b, 6a, 7, 11) — guided entry only, **no PDF parsing/OCR in v1**
(explicitly deferred). Mapping:

- Header → filing status, state; DOBs anchor the household (MFJ adds the spouse).
- 1a wages → a wages stream (joint wages land on the primary with a split-it-yourself note).
- 2b + 3b interest/dividends → an **estimated** taxable account sized at a 2.5% combined yield
  (`ASSUMED_TAXABLE_YIELD_PCT`), with the qualified ratio from 3a/3b — flagged as an estimate to
  replace with the real balance. On a Single return the account is owned by the primary (Joint
  is a couple label and would be wrong for a one-person household). On MFJ the estimate stays
  Joint because the 1040 lines are the combined total. The estimate sources only the lines that fed
  it (2b alone, 3a/3b alone, or all three), so it never claims a line that set nothing on it. Line
  3a only sets the qualified *share* of line 3b, so a 3a with 3b at zero sizes nothing and gets its
  own **not-imported** row naming the reason; that row's remedy depends on whether line 2b already
  seeded the account — with an estimate in the draft it says to set the dividend yield and qualified
  share on that account, and only with nothing seeded does it say to add the account by hand. A 3a
  larger than 3b (impossible on a filed return) says the share was capped at 100% rather than
  claiming it was kept.
- 4b IRA distributions → unmapped pointer (withdrawals are modeled from balances, not history).
- 5b pensions → a pension account paying that amount monthly starting now (COLA/survivor defaults
  flagged).
- 6a SS benefits → a benefit basis with the claim-at-FRA simplification, flagged.
- 11 + 2a → `assumptions.recentAnnualMagi` (the IRMAA two-year lookback).
- Line 7 → guidance only (a loss points at the capital-loss-carryforward field).

Every prefilled value carries a "From your 1040 — line N" review item and is ordinary editable
plan data afterward.

### Not a wizard source: the PDF text-extraction spike

`documentText.ts` reads a PDF's text layer locally, page by page, and ships as the
`@retiregolden/planner-ui/document-text` subpath behind an optional `pdfjs-dist` peer. It is **not**
reachable from `/import` — the wizard still takes no PDF upload, and the 1040 path above is still
guided entry. Its intended consumer is the Pro intake workbench. What it recovers was measured rather
than assumed, per field, against a hand-built synthetic corpus; the numbers and the "do not scope OCR
yet" recommendation are in [document-parsing-spike.md](document-parsing-spike.md).

## Migration from other planning tools

Naming a user's incumbent tool is its own job, separate from mapping its data, and the two are
deliberately not the same size here. `packages/planner-ui/src/import/migrationSource.ts` — published
on the `@retiregolden/planner-ui/migration-source` subpath, browser-free like the rest of the
provenance surface — says **which** tool a file came from, publishes **what can and cannot** be
brought over from it, and emits the unmapped report. It maps no fields itself.

| Tool | Identified by | Mapped | Not mapped, and why |
| --- | --- | --- | --- |
| **ProjectionLab** | The export's **structure** — a root object with a `currentFinances.accounts` array, the same shape `projectionLab.ts` gates on. `meta.app` / `meta.exportVersion` are reported as extra evidence when present, never gated on. | Accounts and balances, taxable cost basis, income sources, expenses summed into baseline spending, birth year, retirement milestone age — by `projectionLab.ts`, unchanged. | Strategies, assumptions, scenarios (modeling choices, not data); Social Security (needs a claim setup, not another tool's projected dollars); filing status and state (absent from the export). The mapper's own checklist reports these, and when a mapper actually ran that checklist is the WHOLE report — `buildMigrationReview` returns nothing for a mapped file, because every status in the review vocabulary either claims a value landed or files as unresolved, and an identification note is neither. |
| **RightCapital** | Its **name** in the document or export text, word-bounded, quoted verbatim. A match in a PDF cites its page; a match in a CSV/JSON export cites the export text, because there is no page to cite. | **Nothing.** | Everything. There is no substantiated export format — see below. |
| **eMoney** | Same. | **Nothing.** | Everything. Same reason. |
| **MoneyGuide** | Same (`MoneyGuidePro` too, whose product name a bare word boundary would miss). | **Nothing.** | Everything. Same reason. |

**For three of the four, we identify the document and name the pages worth reading, while mapping
nothing.** Note what the migration report does NOT do: it never carries the page text. Only bounded
name excerpts and page numbers become review items — the extracted `DocumentPage[]` is the caller's
to keep, and a host that discards it after building the review has nothing left to show beside the
planner screens. (Pro keeps it: WS5's document reader emits the per-page notes separately.) Mapping
nothing is a statement about the format, not about the data. RetireGolden holds no
documented machine-readable export from RightCapital, eMoney or MoneyGuide, and this project does not
bundle proprietary samples — so there is no shape to sniff and no field mapping that could be
justified. Inventing one is the failure mode that actually costs a user something: it lands wrong
numbers in a plan while looking like a successful import. Identification, plus the pages named so the source can be read
beside the planner screens, is the honest position — not a placeholder. **What would change it:** a real
export from a trial account, checked in as a substantiated format with its own fixtures and version
sniffing. Then, and only then, field mapping is in scope.

**Identification is conservative because [WS5's numbers](document-parsing-spike.md) say it has to
be.** Field *selection* on extracted document text measured 17–75% precision — 35 false positives
against 28 selections — and deciding "this is an eMoney report" from the same text is exposed to the
same hazard. So: a product name matches only with **no letter, digit, mark or invisible joiner on
either side** (`projectionlabs`, `rightcapitalization`, `telemoneyguidepro` and a plain "money guide"
all match nothing). That guard is spelled with Unicode-aware lookarounds rather than `\b`, and the
distinction is not pedantry — `\b` is defined over ASCII word characters alone, so a soft hyphen (PDF
text layers carry one wherever a word was hyphenated) or a zero-width joiner manufactures a boundary
and defeats it. `projectionlab`+ZWJ+`oratory` renders on screen exactly like the rejected decoy
`projectionlaboratory`, so the published evidence would have shown a reviewer the innocuous word with
nothing on screen to explain the match. Every match
carries the **surrounding text verbatim**, length-bounded, so a human judges the claim instead of
trusting it; evidence is graded on two tiers where the weaker one reads as weaker (a **structural**
format match versus a mere **name** mention — "all a comparison sheet, a cover letter, or a
screenshot caption would also do"); and a file naming **more than one** tool is reported as
*ambiguous* with every candidate and its evidence, claiming no vendor at all. A comparison sheet is
an ordinary document, and picking the first or most-frequent name would be a guess dressed as an
answer. The one asymmetry: a structural match ends the scan, so a competitor's name inside a real
ProjectionLab export cannot make that export ambiguous — a file's shape is evidence about the file, a
name in its text is evidence about its subject.

Page citations ride as `{ kind: 'none', note: 'page 4' }`. The `SourceLocator` union has exactly five
kinds and no page kind (the WS5 spike did not earn one), and consumers validate it with a closed
switch that rejects the whole payload on a sixth — so an honest "no precise coordinate in this
vocabulary, here is where to look" is the right answer. Citations always come from the extractor's
own `page.page`, never an array index: a page that failed extraction is **absent** from `pages`, so
page numbers are routinely non-contiguous.

The unmapped report (`buildMigrationReview`) reuses `ImportReviewItem` — the same type the free
wizard and Pro's workbench already render, and the same one `reviewToProvenance` already consumes.
Every item is `status: 'unmapped'`, `confidence: 'unmapped'`, with **no** `target`, because nothing
lands in a plan; the colocated tests prove it by feeding the emitted items through
`reviewToProvenance` **and** `serializeImportProvenance` and asserting they all land under
`unresolved`, rather than eyeballing the fields.

## Refresh & reconciliation

New-plan imports build a plan from nothing; the **Update balances** panel does the harder, returning-user
job — folding a fresh broker download into a plan the user has already tuned (allocation, yields,
contribution schedule, beneficiaries) — without disturbing any of that work. That reconciliation model
is a pure, browser-free engine, `packages/planner-ui/src/import/refresh.ts`, published on the
stability-promised `@retiregolden/planner-ui/import-refresh` subpath so the Pro/Advisor repo can drive
the same match-and-apply headless. The panel is a thin view over it.

**Match classification, not source fidelity.** `classifyRefresh` scores each file account against the
plan's balance-updatable accounts (property, debt, pension, annuity are never refresh targets) and grades
the match on a five-way scale of *certainty about which plan account a row refers to*:

- **`exact`** — one plan account whose whole (normalized) name appears in the file label. Defaults ON.
- **`remembered`** — a manual assignment the user made in an earlier refresh of this plan, persisted
  locally and re-offered; it outranks `likely` but a *different* exact match makes the row
  `ambiguous` rather than silently overriding it. Defaults ON.
- **`likely`** — one plan account sharing a distinctive word (whole-word match) with the label. Defaults ON.
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

### Custodian refresh hardening

Each parsed balance carries a broker date when the export supplies one: Schwab account-section headers use
their **as of** date, while Fidelity and Vanguard use a file-wide **Date downloaded** footer. Dates are
accepted only in recognized calendar shapes and normalized to `YYYY-MM-DD`; an unreadable or absent date is
kept as unknown. The preview flags a source date older than seven days with its age in days, and flags an
unknown date too. Both are informational review items: neither stops a user from applying a deliberately
reviewed refresh.

When a user manually assigns a file row and applies it, the planner remembers that normalized broker label
and account id locally for that plan. A later file gives that destination the `remembered` match tier (below
an exact whole-name match and above a likely word match), while the dropdown remains editable. A remembered
destination that no longer exists in the plan is silently discarded rather than offered again.

Every preview includes an exact-cent reconciliation: the total of all parsed file accounts, the total of
rows that will be applied, the remaining unassigned/not-applied total, and the plan's aggregate updatable
balance before and after the preview. The same derived reconciliation is carried into the review checklist;
it is a check, not a tolerance or an automatic adjustment.

Before a successful refresh, the planner records the affected account balances and bases in local IndexedDB,
with the source label and available SHA-256. It retains the newest 10 snapshots per plan. **Restore previous
balances** lists those local snapshots and records a new snapshot before restoring, so a restore is undoable;
accounts deleted since a snapshot are skipped and reported. Snapshots and remembered assignments are
operational data only: they survive reloads on that device but never enter a plan file.

The refresh checklist states that Vanguard holdings exports contain no basis, so a Vanguard balance refresh
leaves existing taxable-account basis untouched. It also reports a file basis that is not written because the
matched account is not taxable or equity compensation; those are the only account types that receive a
broker-file cost basis.

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
speaks **stable account IDs** as **structured entries**, not `accounts[i]` positions: a `RefreshProtectionEntry`
is `{ accountId, field? }`, where a bare `accountId` protects the whole account and `field: 'costBasis'` records
cost-basis-scoped intent. Positions are the wrong currency here because plan-array indices shift as accounts are
added or removed in the workspace, so a stored positional path would silently start protecting the wrong
account; IDs are stable, and the professional host resolves its stored draft-relative paths to IDs once at
approve time instead of re-reconciling indices forever. The entries are **structured rather than
`<id>.<field>` strings** because engine account ids are arbitrary nonempty strings that may contain dots
(`broker.acct-123` is a valid id) and an account id can equal another id's field path — so a flat string like
`a.costBasis` is genuinely ambiguous (whole account `a.costBasis` vs field `costBasis` of account `a`), and no
longest-match guess can resolve that safely; guessing wrong protects the wrong account. The structured shape
carries the split the host already knew, so there is nothing to parse — the `accountId` names the account
verbatim and nested or dotted ids are unambiguous. The panel maps each entry's `accountId` to that account's
**current** index fresh on every render and emits the `accounts[i]` / `accounts[i].<field>` paths the engine's
`protectedTargets` contract expects (entries naming no live account are skipped). The public app renders no
provider and the panel gets an empty list (every account is fair game, unchanged behaviour).

**A host still loading its protected set passes `pending`.** An empty `protectedAccounts` means "nothing is
protected" and cannot express "not known yet", so a host that reads its overrides from a store would otherwise
leave a window in which a broker refresh can overwrite an advisor-frozen account. `RefreshProtectionValue`
therefore carries a `pending: boolean` alongside the entries (read with `useRefreshProtectionPending()`;
`useRefreshProtection()` still returns the entry array unchanged). While it is true the panel refuses **both**
Apply and the file chooser, with a visible explanation naming that cause — distinct from the duplicate-collision
block. The two gates answer different concerns. Apply is refused because applying against an unknown protected
set is unsafe. The file chooser is refused because a preview built during that window would draw every row as
unprotected, with none of the "Protected — advisor override" notes, and then rewrite itself when the real set
arrived — untruthful rather than unsafe, since the panel recomputes every protection-derived value from the live
context on each render. If a host re-enters `pending` after a file was parsed, the panel clears that parse for
the same reason. `pending` defaults to
**false** everywhere it is not supplied, including the no-provider path — the public app mounts no provider and
its protection is genuinely known (empty), so defaulting to true would permanently disable its Apply.

**Field-scoped entries are conservative today: they block the account's whole refresh.** A
`{ accountId, field: 'costBasis' }` entry currently locks the *entire* account's refresh write, not just the
named field — the engine's `applyBrokerBalance` writes balance and cost basis as a unit and cannot skip one
field, so `isProtectedPath` treats a protected field as locking the account (protection errs toward overwriting
*less*). So `{ accountId: 'acct-123', field: 'costBasis' }` protects `acct-123`'s balance too. The `field` form
is accepted so a host can record the intended granularity; finer per-field application is future engine work and
will not change what hosts pass. There is deliberately no `'balance'` field — under the conservative semantics a
balance-only lock is indistinguishable from a whole-account lock, which a bare `accountId` entry already
expresses.

Protected accounts stay **selectable** in every row (marked "(protected)"); selecting one **blocks** that row —
a "Protected — advisor override" note and a small **Allow this refresh** control — rather than being refused, so
even an unmatched row (or one guessed elsewhere) has a path to deliberately refresh a frozen account. A blocked
row contributes nothing to the preview/apply until released. That control is deliberately *transient* and
**row-scoped**: it releases the account for that panel instance only, and only for the row that asked. Release
is tracked as `account id → the requesting row's index`, so the released account is subtracted from the
effective set the panel re-classifies against — while every *other* row that selects it stays blocked with the
note (one releasing row per account) and, defensively, a sibling's selection of it is dropped before
preview/apply (a belt against DOM tampering). Releasing row *k* for account *A* therefore never unlocks *A* in a
sibling row. And because the release is bound to that exact (row, account) pairing, re-targeting row *k* to
anything other than *A* **revokes** the release — protection is restored, and another row may then select *A*,
see it blocked, and release it itself. It is **not** a stored re-decision, the advisor's override record stays
immutable after approve, and releases clear whenever a new file is parsed. Finally, because the workspace reuses
one panel instance across `/plan/:id` navigation, the panel fully resets its transient state (parsed file,
releases, message) whenever the plan **identity** changes — cloned plans share account ids, so this keeps a
stale release from one plan from bypassing protection in another.

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
