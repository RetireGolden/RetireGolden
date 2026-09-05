# RetireGolden Changelog

This is a high-level, time-ordered summary of changes to the system, synthesized from git commit history and the project documentation. Focus is on material additions, refactors, and shifts in scope or architecture. See git history for full detail and code diffs. Enhancements plans (historical intent) are preserved in `DOCS/enhancements/`.

## Unreleased

- Prepared **`@retiregolden/engine` 0.3.1** — a **patch** bump exporting the
  shared `passesModeledOrdinaryWidowRecordGates` helper so modeled ordinary
  widow record gates are not duplicated across callers. **Not yet published.**
- **The planner-ui range moves to `^0.3.1`**, same coordinated-floor pattern as
  the 0.3.0 entry in **2026-09-04** — `@retiregolden/planner-ui` now declares
  `^0.3.1`. Its own version is not bumped here. The new floor stops packaged
  UI from resolving engine 0.3.0, which never exported that helper. Pack
  smoke's `auto` mode still detects the minimum is not on npm, asserts the
  local engine version equals the declared minimum, and packs the exact local
  unpublished minimum.
- **Downstream to coordinate:** publish engine 0.3.1 to npm before any
  planner-ui release that depends on it. Neither package is published by this
  change.

**`@retiregolden/engine` boundary notes, relocated from the package README**

These describe the shape of five `actions/` and `projection/` boundaries as
they were built out. They had accumulated under "Runtime contract" on
[packages/engine/README.md](packages/engine/README.md) — the npm landing page —
where roughly sixty lines of implementation narrative sat above Usage and
buried the actual contract (ESM/Node, purity and the injection seams,
determinism, the optional cash-flow capture, versioned parameter packs).
Recorded verbatim so nothing is lost.

Moving them changes what the README emphasizes, not what the package
publishes: every function named below is exported from `actions/index.ts` and
so is reachable on the `@retiregolden/engine/actions` subpath, and several are
also reachable on their own `actions/<module>` subpath, which
`packages/engine/scripts/pack-smoke.mjs` asserts on every pack. What these
notes are is build-out narrative — how each boundary came to have the shape it
has — rather than the runtime contract a consumer needs on the landing page.

- The owned-IRA penalty prerequisite can accept raw annual SEPP schedule routes,
  rebuild each route's complete inventory from canonical annual character, and
  issue final `iraSeppQualified` zero-penalty decisions only after complete
  reconciliation and exact payment rejoin. Non-success routes remain pending
  and supply no negative-SEPP authority. The pure annual finalizer and
  movement-candidate coordinator now forward these raw routes, accept the
  final qualified outcome, preserve detailed route diagnostics when blocked,
  and bind compact canonical route results into annual evidence. Their public
  staged-date ID builder reproduces planning evidence only; exact coordinator
  rejoin remains the authority, and neither boundary commits movement or
  establishes actionability.
- `coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate` adds
  Plan-identity-authoritative, runtime-snapshot-bound planning evidence around
  that coordinator. It derives the complete Plan owner/year ordinary-withdrawal
  batch and owned non-Roth IRA pool, then requires complete, consistently dated
  opening, year-end, annual basis/line-7, line-8, and exact alive evidence. It
  remains pure and noncommitting: every result keeps movement uncommitted and
  actionability unestablished.
- `buildAnnualRetirementPhysicalEventInventory` is the pure chronology boundary
  in front of future simulator integration. It derives traditional-account Plan
  action allocations internally and exact-rejoins a complete Plan/year/ledger-run
  runtime inventory covering RMD, automatic SEPP, legacy withdrawal/conversion,
  in-year IRA/employer-plan account-balance contribution inflows and employer
  match. Aggregate legacy QCD reclassification, annuity funding, rollover
  inflows, and other traditional transfers stay unresolved until their producer
  and physical endpoints have a typed binding contract. Following-year IRA
  contributions designated for the prior tax year
  remain separate annual-basis facts, not events in this calendar-year chronology.
  A resolved contribution record is the upstream ledger's post-owner-wide-limit
  occurrence, not a contribution candidate; fully suppressed contributions are
  intentionally absent under the complete runtime attestation. The inventory
  checks Plan-local source prerequisites without duplicating shared-limit or
  section 415(c) math. A shared movement authority may cover multiple source
  members only when their owner, kind, origin, date, and sequence agree; upstream
  evidence remains unique per member. It never invents a missing owner, source,
  date, or order: incomplete records and cross-authority chronology conflicts
  fail closed. Successful output
  is a globally ordered immutable stream with owned-IRA pool views and provisional
  Form 8606/QCD categories; it still mutates no balance or basis, calculates no tax
  or penalty, and establishes neither movement nor actionability.
- `buildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput` is the next
  pure evidence boundary for the standalone-compatible Plan-owned IRA batch. It
  exact-rejoins the canonical candidate, complete December 31 owner pool, basis,
  and contribution-window evidence into a frozen classifier input without
  classifying, executing, or integrating with projection.
- `preparePlanOwnedNonRothIraAnnualCandidateTransaction` is the pure provisional
  producer for that batch. It rebuilds the annual physical-event inventory,
  derives the exact Plan-owned action/source batch, and stages it against
  caller-supplied exact-cent balances. Its frozen applications and source
  transitions apply only to a detached snapshot: movement and actionability
  remain unestablished, and it publishes no December 31, tax, penalty, basis,
  or finalization claim.

## 2026-09

**2026-09-04**
- Prepared **`@retiregolden/planner-ui` 0.10.0** — a **minor** bump, and like
  the engine entry below it is minor because the published surface got
  smaller. **Not yet published.**
- **The `"./*": "./src/*.ts"` wildcard export is gone.** This is the breaking
  change. The wildcard resolved *any* deep path under the package, which meant
  it also resolved the paths `files` deliberately excludes from the tarball:
  `@retiregolden/planner-ui/testSupport/samplePlan`,
  `/import/documentBenchmark`, `/import/documentCorpus`, `/import/pdfFixtures`
  and `/report/goldens/*` all resolved cleanly and then failed inside the
  host's own build as a module-not-found on the host's own line. The exports
  map could not say "that is not published", because a wildcard cannot tell
  the difference between a path that exists and a path that merely matches.
  `scripts/pack-smoke.mjs` had called it a hazard in a comment since 0.5.0.
- **The 23 deep subpaths are now named one at a time.** They are the twelve
  RetireGolden-Pro imports — including `data/planStoreContract`, which the
  0.4.4 entry below documents as reaching Pro's desktop library store through
  the wildcard — the one RetireGolden-MCP import, and the ten `app/` imports
  in this repository:

  ```
  ./data/localStore                        ./planner/examples/buildContext
  ./data/planStoreContract                 ./planner/examples/buildExampleCouple
  ./data/v2Backup                          ./planner/examples/buildUnderSavedSingle
  ./householdMap/householdGraph            ./planner/examples/registry
  ./householdMap/mapViewModel              ./planner/format
  ./import/brokerCsv                       ./planner/planContextCore
  ./import/genericCsv                      ./planner/refreshProtectionContext
  ./import/projectionLab                   ./planner/useProjection
  ./import/reviewChecklist                 ./report/reportHtml
  ./import/tenForty                        ./routes/LearnRoutes
  ./learn/learningRegistry                 ./routes/groups
  ./optimize/runOptimize
  ```

  They carry **no stability promise** and may move in any release, patch
  included — the same terms the README gave the wildcard paths. What changes is
  that the set is now finite and written down. `./routes/LearnRoutes` and
  `./routes/groups` are `.tsx` modules published **without** the extension,
  like every other key; a consumer reading the first one's source text asks for
  `@retiregolden/planner-ui/routes/LearnRoutes?raw` and the bundler applies the
  exports map to the specifier and `?raw` to what it finds (this repo's
  `app/scripts/sitemapRoutes.test.mjs` is that consumer, and its import
  dropped the `.tsx`).
- **Null guards for the excluded paths.** `./testSupport/*`,
  `./report/goldens/*`, `./import/documentBenchmark`,
  `./import/documentCorpus` and `./import/pdfFixtures` map to `null`, behind a
  closing `./*: null`, mirroring `@retiregolden/engine`'s map. With no wildcard
  left these are strictly redundant — an unlisted path is already refused — and
  that is the point: they are what keeps those paths refused if a wildcard is
  ever reintroduced, and they name the excluded directories in the one file a
  packaging change is made in.
- **The pack smoke proves the map instead of trusting it.** A sweep now runs
  before the scratch consumer's Vite build, reading the **packed** manifest
  rather than a list kept in the script, so a new key cannot escape it: every
  non-null key must resolve *and* land on a file the tarball actually contains
  (the wildcard's failure, moved from the consumer's build to here), eight
  formerly-wildcard paths must fail with `ERR_PACKAGE_PATH_NOT_EXPORTED`, and
  the null blockers must still be declared. It uses `import.meta.resolve`,
  which applies the map without loading the module — necessary, because this
  package ships TypeScript that node cannot parse. Output:
  `pack smoke: exports map -> 37 subpaths resolve from the tarball, 8
  formerly-wildcard paths refused`.
- **The engine range is `^0.3.0`**, moved by the engine entry below rather than
  by this one. planner-ui gains no new engine export here; its own suite
  follows `decisionFixtures` to `@retiregolden/engine/testing/decisionFixtures`
  in four test files, which is a test-only import and reaches no consumer.
- **Downstream to coordinate:** a host importing a deep path that is not in the
  list above now gets `ERR_PACKAGE_PATH_NOT_EXPORTED` at resolve time instead
  of a module-not-found later in its build. If the path is a real module the
  tarball ships, open an upstream issue and it can be added; if it is under
  `testSupport/`, `report/goldens/` or one of the three import fixtures, it was
  never in the tarball and the old error was a lie about that.
- Prepared **`@retiregolden/engine` 0.3.0** — a **minor** bump, because the
  published module surface got smaller. **Not yet published**; the owner tags
  `engine-v0.3.0` and approves the `npm-publish` environment, and npm serves
  what it serves until they do.
- **Two new published fields on `YearResult`.**
  - `netPortfolioNeed`: the nominal dollars the portfolio must supply that
    year — total expenses plus tax plus penalties, less total incomes, floored
    at zero. planner-ui's bucket lens was computing exactly that per year in
    the UI, which is money math outside the engine; it now reads the published
    field and its own helper is gone. Assembled in `annualYearResultAssembly`,
    where all four inputs are final, and published last in the literal so no
    existing key moves position.
  - `InheritedAccountYearEvidence.refusalCode`: the discriminated cause behind
    `refusalReason`. The prose is reader-facing text that names the specific
    fact or rule, and the Results page was classifying it with seven
    `includes()` checks — so rewording an engine message silently rewrote the
    user's explanation. The union is `successor-beneficiary`,
    `entity-beneficiary`, `multiple-beneficiaries`, `employer-plan`,
    `needs-review`, `successor-clock-out-of-scope`; there is deliberately no
    member for the labeled legacy planning approximation, which publishes no
    refusal at all. `refusalReason` is unchanged, word for word, and the
    substring reading survives as the fallback for results serialized before
    codes existed.
- **Twenty-nine `./actions/<name>` subpaths removed.** This is the breaking
  part, and the reason for the minor rather than a patch. The export map
  listed 39 of them behind the `"./actions/*": null` blocker; 29 had no
  importer anywhere — not in RetireGolden-Pro, not in RetireGolden-MCP, not in
  `app/` or `planner-ui` — and every listed name is public API a semver bump
  then has to honour. Removed: `annualHsaOpeningAuthority`,
  `annualHsaPenaltyEvaluation`, `annualHsaPhysicalMovementCandidate`,
  `annualHsaReimbursementLedger`, `annualHsaTreatmentBindingCoordinator`,
  `annualHsaWithdrawalCharacter`, `annualIraBasisAllocation`,
  `annualOwnedNonRothIraPoolCapacity`, `annualQcdPhysicalExecution`,
  `annualQcdResidualForm8606`, `annualQcdTaxCharacterPostPass`,
  `annualRetirementActionMovementCoordinator`,
  `annualRetirementActionPublication`,
  `annualRetirementPhysicalEventInventory`,
  `ownedNonRothIraAnnualCandidateCoordinator`,
  `ownedNonRothIraAnnualCandidateTransaction`,
  `ownedNonRothIraAnnualFilingEvidence`,
  `ownedNonRothIraAnnualFilingSourceResolver`,
  `ownedNonRothIraAnnualFinalization`,
  `ownedNonRothIraAnnualPlanCoordinator`,
  `ownedNonRothIraAnnualPostCandidateEvidence`,
  `ownedNonRothIraMovementCandidate`, `ownedNonRothIraPenaltyPrerequisite`,
  `ownedNonRothIraSeppAnnualReconciliation`,
  `ownedNonRothIraSeppCurrentPaymentCandidate`,
  `ownedNonRothIraWithdrawalCharacter`, `rothConversionExecution`,
  `taxableWithdrawalCharacter`, `traditionalEmployerPlanPenaltyPrerequisite`.
- **The ten kept subpaths are unchanged**, and they are the ten this monorepo
  imports one at a time: `actions/annualQcdExecutionPrerequisite`,
  `actions/civilDate`, `actions/contract`, `actions/execution`,
  `actions/identity`, `actions/money`, `actions/planBalanceAdapter`,
  `actions/reasons`, `actions/retirementActionCandidateIdentityAllocator`,
  `actions/retirementActionManualReview`. **No module became unreachable**:
  all 29 pruned names are still exported from the `./actions` barrel, which
  `publishedSurface.test.ts` proves for every one of them by comparing the
  source modules against the package's export map and the barrel's re-export
  list. Pack smoke adds a runtime check in the packed artifact — `typeof`
  assertions through the barrel for a representative subset of the 29, plus a
  new loop asserting every pruned subpath fails with
  `ERR_PACKAGE_PATH_NOT_EXPORTED`.
- **One subpath added: `./testing/decisionFixtures`.** `decisionFixtures.ts`
  moved from `src/decisions/` to `src/testing/`, beside `planFixtures.ts` and
  `flatTax.ts`. Its own header called it "test-only — not exported from the
  module index, so it never reaches the app bundle", which was true of the
  barrel and false of the tarball: the build excludes only `*.test.ts` and
  `*.test-support.ts`, so it always shipped — as
  `dist/decisions/decisionFixtures.js` — pulling `parsePlan`,
  `createFederalTaxCalculator` and `simulate` into its graph. Publishing it
  is the right answer rather than hiding it — planner-ui's suite already
  imports these fixture plans across the package boundary, and a consumer
  writing decision-engine tests needs the same ones — so the directory now
  says what the packaging did. The old
  `./decisions/decisionFixtures` path is gone; there is no shim, because the
  only importers are test suites in this monorepo and neither RetireGolden-Pro
  nor RetireGolden-MCP imports it. Its coverage attestation moved with it, from
  `attestations/decisions.ts` to `attestations/testing.ts`, unchanged in
  substance.
- **`testIds` became `makeTestIds(scope)` in the same file.** A single
  module-level `let counter = 0` behind a shared `testIds()` meant a fixture's
  account and income ids depended on how many other fixtures had been built in
  that module instance first — so the same builder produced different ids on
  its second call, and adding a fixture call above another silently renumbered
  the one below it. Nothing pinned an id, so nothing was wrong; it was a trap
  waiting for the first test that did. Each builder now opens its own sequence,
  scoped by name (`dec-tradHeavy-1`), which also keeps `mixedTraditionalPlan`
  — which composes `inheritedOnlyPlan` and adds an account — from minting an id
  the composed plan already used. `decisions/assetLocationInvariance.test.ts`
  was the one importer of the shared counter and now opens its own with
  `makeTestIds('assetLocationInvariance')`; the two accounts it actually pins
  were already file-local literals. Ledger output is unaffected: the
  differential equivalence dump over the `full` corpus (150 members, 600
  entries) is byte-identical to the branch base.
- **The planner-ui range moves in the same commit, and it has to** — the same
  `linkWorkspacePackages` reasoning as the 0.2.0 entry below:
  `@retiregolden/planner-ui` now declares `^0.3.0`. Its own version is not
  bumped here. The pack smoke's `auto` mode detects that 0.3.0 is not on npm,
  asserts the local engine's version equals the declared minimum, and packs
  the local engine: `packing the exact local engine minimum 0.3.0 ... pack
  smoke OK ... against local minimum 0.3.0`.
- **Downstream to coordinate:** a consumer importing any of the 29 pruned
  subpaths changes the import to `@retiregolden/engine/actions`; the exported
  names are identical. A consumer that constructs a `YearResult` literal now
  has to supply `netPortfolioNeed`, which is required rather than optional
  because the ledger always publishes it.

## 2026-08

**2026-08-31**
- Import & migrate (`/import`) landing source cards share the same 2×2 grid as
  Getting started on `/`. The step back control sits with the source heading as
  a readable secondary button, and returning from a step restores keyboard
  focus to the card that was opened.
- Prepared **`@retiregolden/engine` 0.2.0** — the first **minor** bump in the
  0.1.x line, and deliberately not a patch. **Not yet published** — the owner
  tags `engine-v0.2.0` and approves the `npm-publish` environment, and npm
  serves 0.1.12 until they do. Plan schema v5 (PR #382) added a
  **required** `inflationAdjusted` boolean to a one-time income stream, which
  breaks a `^0.1.x` consumer in two ways: a TypeScript caller constructing a
  `oneTime` income literal stops compiling, and a caller handing `parsePlan` a
  v4-shaped plan object gets a validation failure unless it routes through
  `migratePlanToCurrent` first. Stored documents are unaffected — migrating them
  is exactly what the v4 → v5 step is for. The repository's usual discipline of
  shipping engine changes as patches exists to keep additive exports inside the
  `^0.1.0` range consumers declare (see the 0.1.3 and 0.1.5 entries); that
  reasoning does not apply here, because shipping a breaking change as 0.1.13
  would silently break every caret consumer on its next resolve, which is the
  one thing the caret is supposed to promise against.
- **The planner-ui range moves in the same commit, and it has to.**
  `linkWorkspacePackages: true` still honours the declared range, so leaving
  `@retiregolden/planner-ui` on `^0.1.12` while the workspace engine reads
  0.2.0 stops pnpm linking the checkout and silently resolves the *published*
  v4 engine instead — measured: the lockfile flips from `link:../engine` to
  `version: 0.1.12`. planner-ui source requires v5, so that state is broken, and
  `workspace:` protocol is not an option here (see `pnpm-workspace.yaml`: these
  packages ship via `npm publish`, which does not rewrite it). The two version
  edits are therefore one atomic change, not the usual split.
- **No release window to manage, because the pack-smoke already anticipated
  this.** planner-ui's smoke test normally resolves its declared engine minimum
  from the registry, which would fail here — 0.2.0 does not exist on npm yet.
  Its `auto` mode detects exactly that and packs the LOCAL engine instead,
  asserting the local package version equals the declared minimum before it
  does. Verified by running it: `packing the exact local engine minimum 0.2.0
  ... pack smoke OK ... against local minimum 0.2.0`. So `main` stays green
  between this merge and the publish, and the check flips back to resolving
  from the registry once 0.2.0 is live, with nothing to change. The currently
  published planner-ui 0.9.0 is unaffected and internally consistent — it was
  built against the v4 engine and resolves one.
- **Hardened the fallback this release leans on.** The registry probe caught
  every error and answered "not published", so a network blip, a rate limit or
  an auth failure was indistinguishable from an absent version: `auto` would
  quietly pack the local engine and CI would stay green while the
  registry-resolution path went unexercised. It now reads npm's structured
  `error.code` (available because the probe already passes `--json`) and treats
  only **E404** as absence, throwing otherwise with a message pointing at
  `PLANNER_PACK_SMOKE_ENGINE_SOURCE=local` for a deliberate local pack. Both
  branches measured: an unpublished version reports `E404` and still falls back;
  an unreachable registry reports `ECONNREFUSED` and now fails loudly instead of
  silently downgrading the check.
- **planner-ui is not re-released here.** Its `^0.2.0` range ships whenever it
  next publishes; nothing about the currently published 0.9.0 changes.
- **Downstream to coordinate:** the RetireGolden MCP reads the shipped Plan JSON
  Schema, so `describe_plan_schema` reports **v5** once it picks this up, and
  `build_plan` must author `inflationAdjusted` on a one-time income. The
  historical `schema/plan.v1.json` … `plan.v4.json` artifacts remain shipped at
  their versioned subpaths, so a consumer pinned to an older document shape can
  still read the schema it was written against.

**2026-08-30**
- Moved the flat-rate tax stub out of the projection engine and into the
  testing-support surface, without breaking anyone. The body moved from
  `packages/engine/src/projection/flatTax.ts` to
  `packages/engine/src/testing/flatTax.ts`; the old path now re-declares it as
  a deprecated alias, so `@retiregolden/engine/projection/flatTax` still
  resolves and still exports the same `createFlatTaxCalculator` — the identical
  function object, not a copy. No consumer breaks. All 89 in-repo importers (85
  engine test files, 4 planner-UI test files) moved to
  `@retiregolden/engine/testing/flatTax`, leaving the old subpath with no
  in-repo product or test consumers — the only in-repo code that still names it
  is the pack-smoke guard that keeps it honest; it exists for external code
  pinned to it. The arithmetic is untouched and no fixture's expected dollar
  changed. The alias shape is deliberate: TypeScript does not report a
  `@deprecated` tag attached to a bare `export { x } from` re-export, so that
  shape would have shipped a marker no consumer ever sees; the alias reports at
  both the import and the call site. Pack-smoke now proves both subpaths
  resolve, yield the same function object, stay nameable from a compiled
  consumer, and that the deprecation is actually reported to that consumer by
  the TypeScript language service — so the alias shape above is enforced rather
  than merely explained, and the compatibility promise with it. Removal is
  deferred to a future major and is **not** scheduled; when it happens it must
  be done by adding an exact `"./projection/flatTax": null` exports key, which
  wins over the `./projection/*` pattern — never by deleting that wildcard,
  which would take down every other projection subpath including
  `projection/simulate` — and the pack-smoke guard above has to come out in the
  same change, since it consumes the subpath it protects.
- Corrected stale roadmap framing that outlived the work it described. The stub
  called itself a "V1 placeholder" awaiting replacement "in roadmap phase V2",
  and the `TaxCalculator` interface said the same. The real federal engine
  shipped long ago, and nothing is queued to replace this file — it is the
  permanent, deliberate test double for those 89 suites. Both comments now say
  so. The interface's comment mattered most: it is re-exported through the
  public `projection/types.js` façade and emitted into the shipped `.d.ts`, so
  consumers were reading the outdated claim in editor tooltips.
- Reversed the planner-UI / MCP dependency direction so all arrows point one
  way. `@retiregolden/planner-ui` no longer dev-depends on the published
  `@retiregolden/mcp`; the MCP depends on planner-UI, never the reverse. The
  "Copy plan for your AI" round-trip guard moved with it, from
  `packages/planner-ui/src/data/planForAi.roundtrip.test.ts` to
  `tests/planForAiRoundtrip.test.ts` in RetireGolden-MCP (its PR #59), where it
  runs against that repo's local adapter instead of a published tarball — so a
  `build_plan` regression now fails in the pull request that causes it rather
  than waiting for an npm release to carry it across. Dropping the dev
  dependency also removed the eight sourcemap-resolution warnings
  `@retiregolden/mcp`'s `dist` emitted on every planner-UI test run, and the
  `server.deps.inline` block that existed only to serve that one test. The
  **producer** side of the contract is still enforced here by the
  `serializeSinglePlan` block in `packages/planner-ui/src/data/planFormat.test.ts`;
  what left is the **consumer** round trip through a real `build_plan`, which
  now reaches the guard only after planner-UI publishes and the MCP repo picks
  up the new version. Recorded because that is a real detection delay, not a
  free move: treat `serializeSinglePlan` as a published contract.

**2026-08-29**
- Replaced automatic standalone Grok PR review with the independent OpenRouter
  review workflow and stable `review / openrouter-first-pass-gate` context.
  The legacy Grok workflow is manual-only; it is not an OpenRouter fallback.

**2026-08-25**
- Re-enabled the production web import capability after the WS6 incident-switch
  rehearsal proved the deployed one-key switch removed every browser file-input
  surface while preserving manual entry, existing-plan access, exports, and
  RetireGolden backup recovery.
- Disabled the production web import capability for the WS6 incident-switch
  rehearsal. Browser file inputs remain unmounted while disabled; manual plan
  entry, existing plans, exports, and RetireGolden backup recovery remain
  available. A separate reviewed PR restores the capability after live
  verification.
- Added a fail-closed, no-store web incident switch for file-backed import.
  Missing, malformed, oversized, redirected, non-200, extra-key, or disabled
  config removes the new-plan wizard, broker CSV refresh, mySSA XML import,
  and FedInvest CSV fallback before their file inputs render. Manual entry,
  existing-plan access, exports, and RetireGolden backup restore remain
  available; the switch is explicitly excluded from PWA precaching.

**2026-08-21**
- Closed reverse-gap registry record `irc-4974-rmd-shortfall-excise-tax`.
  The annual ledger now charges 25% of each computed RMD shortfall on
  `YearResult.penalties`, with partial payments reducing the base dollar for
  dollar. Explicit same-applicable-plan correction plus Form 5329 evidence can
  select 10% only inside the earliest statutory correction-window endpoint;
  requested or denied reasonable-error waivers retain tax, while an explicit
  grant and the final regulation's two automatic fact patterns reach zero. An
  opt-in first-year deferral carries the first amount to April 1 and places a
  miss in the RBD year alongside that year's separate RMD. Explicit 403(b)s
  aggregate per owner; inherited accounts aggregate only with an explicit
  same-decedent identity. Living-owner Roth IRAs stay outside lifetime RMDs;
  inherited Roth shortfalls are covered. The chapter 43 tax is isolated from
  income tax, AGI, MAGI, IRMAA, §86, and ACA calculations.
- Planner-home first-run chrome (#297): empty-library tab title is `RetireGolden`
  (not `Your plans`), Getting started is a 2×2 of equal cards, the header uses a
  readable wordmark instead of the lockup PNG's 5–6px baked-in tagline, skip-to-content
  sits in flow above the header when focused, the Theme control has a visible
  group label and no longer shares the primary-CTA gold fill, Start here is a
  column of links, and disabled **Download plan backup** names why
  (`No plan to export yet`).

**2026-08-20**
- Closed the reverse gap on **IRC §401(k)(2)(B)(i) employer-plan conversion
  source / distributability** for the aggregate Roth-IRA path. `isConvertibleToRoth`
  now refuses an owned employer traditional account unless the projection year
  can prove severance (attained age at or past `retirementAge`) or age 59½
  (attained-age-60 proxy). The weight and drain loops both read that predicate,
  so a still-working participant under 59½ converts $0 and the year names the
  refusal. The same locked-employer warning fires when an IRA only partly fills
  the request and a gated 401(k) sits unused. The public one-argument
  `isConvertibleToRoth(account)` call is kept: IRAs stay convertible; employer
  accounts fail closed when year-level context is absent. In-plan Roth of
  otherwise nondistributable amounts under §402A(c)(4)(E) remains a different
  enacted act and is not modelled.
  Registry record `irc-401-k-2-B-i-employer-plan-conversion-source-not-gated-by-distributability`
  reclassified `approximated` → `settled`.
- 1040 guided seed form handling: money fields replace (instead of appending into
  a formatted value / Chromium `insertReplacementText`), the date-of-birth year
  segment is capped at 4 digits, and Backspace in Line 7 no longer submits the
  form. A Single-filing estimated brokerage is owned by the primary, not Joint.

**2026-08-19**
- Prepared **`@retiregolden/engine` 0.1.12** (patch — the engine half of the
  §414(v)(7) high-earner designated Roth catch-up below, including its
  §415(c) exclusion, the compensation-minus-other-electives cap, the Plan v4
  schema regeneration carrying `priorCalendarYearFicaWages`, and the
  §408(d)(8)(A) post-70½ QCD offset corrections on the aggregate `qcdAnnual`
  arm). Released as a pair with planner-ui 0.9.0, whose engine floor moves to
  `^0.1.12` because the UI reads and writes the new Box 3 field — the pins
  move together.
- Prepared **`@retiregolden/planner-ui` 0.9.0** (minor — additive public
  subpaths and import hardening, plus the §414(v)(7) calculation addition
  below; requires `@retiregolden/engine ^0.1.12`). The new public, browser-free **`./complete-export`** subpath
  publishes the read/verify half of the `retiregolden.complete-export` v1
  planning-record contract: the typed manifest shape, `parseCompleteExportManifest`
  (liberal on producer labels, strict on integrity — safe-integer totals
  equations, Win32-folded path-collision refusal, declared-limit
  self-consistency, the pinned Free bridge path), the `manifest.sha256`
  sidecar grammar, and fail-loud Web Crypto verifiers. There is deliberately
  no writer — RetireGolden Pro remains the sole producer. Custodian file
  refresh (Schwab/Fidelity) hardened end-to-end: statement as-of extraction
  with local-calendar staleness flags, whole-word account matching with
  broker-scoped remembered assignments, exact-cent reconciliation, and
  durable pre-mutation refresh snapshots with protection-honoring
  restore-and-undo. Also carries KPI-bar and planning-age layout fixes and
  the workspace's npm→pnpm switch (packaging and publish pipeline
  unchanged in behavior).
- Implemented **IRC §414(v)(7) high-earner designated Roth catch-up** (SECURE 2.0
  §603) for contribution years 2026+. Employer-plan catch-up above the §402(g)
  base is recharacterized as designated Roth when prior-year FICA wages from the
  sponsoring employer **exceed** $150,000 (Notice 2025-67). Exactly $150,000
  stays pre-tax-eligible. No Roth employer account for that owner ⇒ the high-earner catch-up
  is $0. Super catch-up ages 60–63 is the same §414(v) slice. IRA / HSA / SEP /
  SIMPLE IRA are untouched. The wage test is a user-entered Box 3 proxy on the
  employer account (`priorCalendarYearFicaWages`); omitted defaults to 0 and is
  not subject. T.D. 10033 does not delay the 2026 statutory mandate to 2027.
  Redirected catch-up is not reported as an IRS-limit cut, is excluded from
  §415(c) by §414(v)(3)(A), is limited by §414(v)(2)(A)(ii) to compensation
  minus other electives, and remains elective deferral of the source plan
  for match.

**2026-08-13**
- Prepared **`@retiregolden/planner-ui` 0.8.0** (minor — additive supported
  governance record-capture seams; no calculation changes). The new public,
  browser-free **`./projection`** subpath promotes the planner's deterministic
  `projectPlan(plan, startYear)` projection, its view type, and the clock
  helper without pulling in React. Evidence hosts pass and record an explicit
  start year, then retain the exact projection result and summary instead of
  re-running a plan later.

  The existing **`./report-model`** subpath now adds backward-compatible
  `parseReportModel`: it validates the envelope (kind, supported version
  1..current, field types, block structure) and returns a `ParsedReportModel`
  whose `provenance` and `blocks` are structurally validated but untyped
  (`Record<string, unknown>`). It rejects malformed, oversized, or newer
  envelopes with a caller-visible upgrade message. Hosts that wrote the bytes
  with `serializeReportModel` at the current version may assert to `ReportModel`
  after checking `model.version === REPORT_MODEL_VERSION`; all other consumers
  must narrow field-by-field. Hosts re-rendering persisted models must handle
  absent or unknown blocks and warn rather than drop silently. Serialization
  remains deterministic; no retirement, tax, or money calculation changed.

## 2026-07 (July 2026 Depth Wave)

**2026-07-30**
- Prepared **`@retiregolden/engine` 0.1.9** (patch — additive Plan v3 retirement-action
  eligibility-fact persistence and schema support). Planner UI source that reads those facts now
  requires `@retiregolden/engine ^0.1.9`; its packed-consumer smoke installs and compiles against
  the exact supported minimum, using the local 0.1.9 tarball only until that version is available
  from the registry.

**2026-07-26**
- Prepared **`@retiregolden/engine` 0.1.8** and **`@retiregolden/planner-ui` 0.6.2**
  (patches — additive Advisor meeting WS8 performance seams, with no calculation changes).
  Engine scenario comparisons can now report genuine completed shared-path work across baseline
  and proposal while keeping callbacks out of result provenance. Planner UI's public
  `./spending-solve` facade now accepts an optional `AbortSignal`; aborting terminates active
  worker work, removes listeners, settles once with `AbortError`, and ignores late events.
  Regression coverage pins monotonic `1..2N` comparison progress, already-aborted behavior,
  active-worker termination, and late-message safety. Calculation cases remain unchanged.
- Prepared **`@retiregolden/planner-ui` 0.6.1** (patch — additive, browser-free intake refresh contract; no public planner UI behavior change). The new supported **`./intake-refresh`** subpath lets a professional host classify, preview, and apply narrowly allowlisted updates from a later intake to the same saved plan. It recognizes only annual wages, recurring annual income, one-time income amounts, and recent annual MAGI, and it requires provenance-backed semantic identity before a candidate can update anything. Stable current-plan IDs and semantic bindings flow through classification, delta construction, and application; Unicode-aware matching prevents visually deceptive names from becoming accidental identities.

  Refreshes are fail-closed. Duplicate matches, stale or malformed deltas, changed target values, missing targets, and protected paths cannot be applied. Accepted candidates write only their single supported money leaf; rejected or merely unmatched candidates leave the plan unchanged. The contract never adds or removes records and does not refresh Social Security, accounts, household or filing status, historical MAGI, timing, growth, tax treatment, or strategy fields. A Pro host remains responsible for sealing the base snapshot, authorizing the saved-plan target, collecting explicit review decisions, and committing the exact preview atomically.

**2026-07-25**
- Prepared **`@retiregolden/planner-ui` 0.6.0** (MINOR — a new supported subpath, plus an additive field on an existing one). Ships the **migration-source identifier** (advisor-intake WS6) on `@retiregolden/planner-ui/migration-source`: it says WHICH incumbent planning tool a user-provided file came from, publishes what can and cannot be brought over from it, and emits the mandatory unmapped report. It maps no fields itself, and the shape of the surface is deliberately lopsided — one mapper, three identifications. ProjectionLab is recognised by the export's **structure** (the same `currentFinances.accounts` shape `projectionLab.ts` already gates on) and mapped by that existing mapper, unchanged and not duplicated. RightCapital, eMoney and MoneyGuide are **identified only**: RetireGolden holds no documented machine-readable export from any of them, the plan forbids bundling proprietary samples, and inventing column names for a format nobody here has seen is the failure that actually costs a user something — it lands wrong numbers in a plan while looking like a successful import. So those three get identification, published limitations, and the manual path, and a field selector for one of them does not belong in the file. What would change that is a real export from a trial account, checked in as a substantiated format with its own fixtures.

  **Identification is conservative because the WS5 benchmark says it has to be** — field *selection* on extracted document text measured 17–75% precision, and deciding "this is an eMoney report" from the same text carries the same hazard. A product name matches only with no letter, digit, mark or invisible joiner on either side, and the guard is spelled with Unicode-aware lookarounds rather than ``: `` is defined over ASCII word characters alone, so a soft hyphen (PDF text layers carry one wherever a word was hyphenated) or a zero-width joiner manufactures a boundary and defeats it, and `projectionlab`+ZWJ+`oratory` renders on screen exactly like the rejected decoy `projectionlaboratory`. Every match carries its surrounding text **verbatim**, bounded, with control and format characters and lone surrogates rendered as visible `<U+XXXX>` — evidence that shows a character the file never held is not evidence. Evidence is graded so a mere name mention reads weaker than a structural format match, a file naming two tools is reported *ambiguous* with no vendor claimed, and a file past the size cap answers `too-large` rather than being scanned or silently dropped. A `meta.app` naming a different product is published as evidence **against** the identification rather than quietly among the support. Extracted pages are reported by state — text, clipped, an unreadable image, nothing the reader could read, and the pages that never opened at all — and no sentence claims more than the extractor's signals can carry: `imageOnly` is set by any raster paint operation and measures no coverage, so a page is never asserted to *be* a scan, and a textless page is never asserted to be empty (a report whose text was converted to outlines looks identical from where the reader stands). The report **names** the pages worth reading and never carries their text; a caller keeps the extracted `DocumentPage[]` itself. Every item is `status: 'unmapped'` with no `target`, proven by round-tripping through `reviewToProvenance` and `serializeImportProvenance` rather than by inspecting fields.

  **`./import-provenance` gains one additive field**: the `none` locator variant takes an optional `sourceIndex`. `none` means "no precise coordinate in this vocabulary", not "no source" — a page citation, or a checklist entry about a file as a whole, has a perfectly definite file behind it — and without the field a multi-source envelope silently filed every such entry against `sources[0]`, which for a report built mostly of `none` locators means most of it was attributed to the wrong file. The default differs from a coordinate leaf on purpose: omitted on `csvRow`/`jsonPath`/`form1040` still means `sources[0]`, while omitted on `none` means no source is named at all, which is what preserves the existing property that a `none` locator may sit in an envelope with an empty `sources[]`. `describeSourceLocator` renders it. Reading code that ignores the field behaves exactly as before, which is why this is a minor rather than a major — but it is not a patch, because a new supported subpath is new API.

  The free wizard is untouched: `ImportPage` offers no PDF upload and no migration surface, so this module's consumer is the Pro intake workbench, the same posture `./document-text` has. The engine range stays `^0.1.7` (published), so **no engine release is needed**.
- Prepared **`@retiregolden/planner-ui` 0.5.1** (patch — additive shared-service exports, no UI behavior change). Adds two supported edition-neutral subpaths for professional hosts composing the public planner: **`./plan-tax-calculator`** exposes the existing `taxCalculatorFor(plan)` adapter so engine comparisons use the planner's federal/state/local tax stack, and **`./spending-solve`** exposes the existing worker-backed `runSpendingSolve` contract plus its request/result/evidence/response types. The spending executor now calls the same tax adapter directly, removing a duplicate assembly path without changing calculations. Tarball smoke coverage imports both supported subpaths from the packed package and continues to require the spending-solver worker chunk; focused tests pin direct-engine tax-stack parity and the Promise-based synchronous fallback when `Worker` is unavailable.

**2026-07-24**
- Released **`@retiregolden/planner-ui` 0.5.0** (MINOR, not a patch — the Node floor moved). Two additive feature sets shipped together, plus one change that is breaking for anyone on an older runtime, which is what decides the version. **`engines.node` moves from `>=20` to `>=24`** across the repo and CI: Node 20 reached end of life in April 2026, `pdfjs-dist@6` requires `>=22.13`, and RetireGolden-Pro — the package's principal consumer — already declared `>=24`, so the producer was looser than its own consumer. A consumer on Node 20–23 can no longer install this release, and calling that a patch would be a false compatibility claim. **The `@retiregolden/planner-ui/scenario-levers` subpath** (advisor-meeting workspace) adds the canonical fast-lever contract — every definition declares the RFC 6901 paths it may patch and each result reports the operations actually emitted. **The `@retiregolden/planner-ui/document-text` subpath** (advisor-intake WS5) adds local PDF text extraction: per-page text with a 1-based page number as the citation, image-only detection for the scanned page an OCR pass would be needed for, and a result union whose reasons distinguish a problem with the document from a problem with the host's pdfjs — so an integration fault is never shown to a user as a problem with their file. Nothing throws for a bad document. `pdfjs-dist` is an **optional peer**: a browser host injects its own module (`options.pdfjs`), Node and SSR fall back to a dynamic import, and a host that never imports the subpath installs nothing and ships no pdfjs bytes. The published `SourceLocator` union is deliberately unchanged — adding a page-citation kind would make every new provenance export unreadable by an older consumer, and the accuracy benchmark that would justify it has not answered yet. `RefreshProtectionValue` gains an **optional** `pending` flag (source-compatible; the no-provider default stays `false`) so a host resolving protection asynchronously can say "not known yet" instead of accidentally saying "nothing", and `UpdateBalancesPanel` refuses both apply and file selection while it is set. Free-app behaviour is unchanged throughout: the import wizard still offers no PDF upload, and it mounts no refresh-protection provider.
- Released **`@retiregolden/planner-ui` 0.4.9** (patch — additive scenario comparison workspace). The Scenarios page now consumes the shared `@retiregolden/engine` 0.1.7 comparison service for baseline-versus-proposal headline, spending, income-source, withdrawal, IRMAA, estate, annual-ledger, and shared-market risk deltas, with explicit nominal/today's-dollar bases and proposal-minus-baseline direction. Sustainable spending capacity runs as two worker-backed exact-ledger solves and reports converged maxima, feasible lower bounds, unavailable results, limiting constraints, and plan-prefixed diagnostics. Every result is bound to plan/scenario fingerprints, projection year, selected scenario, and stochastic settings so rapid changes, equivalent-scenario switches, stale successes, and stale failures never become current output or leave calculation controls stuck. Invalid in-progress drafts and fingerprint failures remain in the workspace as clear unavailable states instead of crossing the route error boundary. Accessible tables, a single assertive status path, explicit Current/Recalculating/Error/Unavailable labels, New Year rollover handling, and `never` depletion semantics complete the presentation contract. Requires the published **`@retiregolden/engine ^0.1.7`**; no existing public API was removed.
- Prepared **`@retiregolden/engine` 0.1.7** (patch — additive scenario-comparison API). Adds the canonical baseline-versus-proposal comparison contract for headline outcomes, tax and penalties, spending, income and withdrawal sources, estate, annual-ledger rows, and same-seed shared-path risk; every numeric change uses proposal-minus-baseline semantics and identical plans normalize to exact positive-zero deltas. The projection ledger now records IRMAA-only surcharge dollars directly alongside total Medicare premiums and tier, so consumers never re-price the surcharge. Optional sustainable-spending-capacity comparisons preserve convergence and diagnostic metadata, while per-plan tax calculators are required so geography changes cannot silently reuse the baseline tax stack. Planner-ui adopts this API in a follow-up release and must require `@retiregolden/engine ^0.1.7` after this engine version is published.
- Released **`@retiregolden/planner-ui` 0.4.8** (patch — purely additive). Ships the **`RefreshProtectionProvider` seam** (advisor-intake WS4, the panel-side injection point the Pro repo consumes): a React context provider plus `useRefreshProtection()` through which a host app declares which accounts carry advisor-controlled values, as **structured id-based entries** `{ accountId, field?: 'costBasis' }` — account *ids*, not positional paths, so a host's protection set stays correct when the user reorders or deletes accounts between advisor sessions; ids never need parsing, so ids containing dots are safe by construction. The Accounts screen's `UpdateBalancesPanel` resolves entries to the engine's positional `protectedTargets` fresh each render and blocks matching rows: protected rows default OFF, stay individually selectable, render a "Protected — advisor override" note, and carry a per-row **"Allow this refresh"** release that is deliberately **transient** — row-scoped (releasing one row never unlocks another row targeting the same account), cleared on new file, reset, or plan switch, and never persisted, so an advisor's override survives every future refresh unless the user re-releases it each time. A field-scoped entry (`costBasis`) conservatively blocks the whole account row, because the engine's write primitive updates balance and cost basis as a unit — documented on the type so a host can't assume finer granularity than the write path honors. A partial apply (some rows written, others protection-blocked) names the held-back count in the status message, since the preview table and its audit are gone by then. The panel also gained commit-safe concurrency guards hardened through the review loop: a synchronous read-epoch invalidates in-flight file reads superseded by a newer pick, and the committed-plan-id ref advances in a layout effect so a discarded concurrent render can never mis-arm the plan-switch reset. The default context value is an empty protection set, so the public planner is byte-for-byte behavior-identical without a provider; the seam is inert until a host mounts one. No existing API changed; no engine or provenance surface moved.
- Released **`@retiregolden/planner-ui` 0.4.7** (patch — purely additive, source-only). Ships the **broker-refresh/reconciliation engine** (advisor-intake WS4, public half) on the second stability-promised subpath, `@retiregolden/planner-ui/import-refresh` — like the sibling `./import-provenance`, a supported API whose exported names and signatures only move on a semver-major, and deliberately browser-free (no DOM, no `crypto.subtle`) so the Pro/Advisor repo or a Node process can classify and apply a refresh headless. It is the returning-user "update my balances from a fresh broker download" path factored out of the Accounts panel into three functions. **`classifyRefresh`** matches each parsed broker row to a plan account and returns a `RefreshClassification`: per-row **`RefreshMatchKind`** verdicts (`exact` / `likely` / `ambiguous` / `unmatched` — deliberately **not** `ImportConfidence`: that scale grades how faithfully a *value* survived the trip, this one grades how sure we are *which account* a row refers to, and one enum for both would let a UI equate "we're sure this is your Roth" with "we copied this number exactly") plus a faithful `protectedPaths` snapshot of any caller-supplied protected set. False positives are engineered out rather than hoped away: a lone hit on a shared account-type *category* word ("IRA") grades `ambiguous` and defaults OFF — so a plan holding only a Rollover IRA never silently pre-selects "overwrite it with the file's Roth IRA number" — with the runners-up kept on `alternativeAccountIds` as the audit trail; and label normalization strips only digit-*heavy* parentheticals, so "(Z12345678)" is an account-number mask but "(Joint)" is name content, and short digit runs survive as words ("401k", "529"). **`buildRefreshDelta`** previews the exact before→after field writes by running the selection on a clone through the **same single write primitive `applyRefresh` uses**, so the preview structurally cannot diverge from the apply; it also surfaces the updatable accounts no row touches (their balances are going stale) and duplicate collisions (two rows assigned to one plan account), which are never auto-merged — a single collision empties the preview's changes list and makes **`applyRefresh`** a full no-op (writes nothing, returns 0), matching the panel's disabled apply button, so a headless caller reaches the same verdict. The delta carries a `reviewToProvenance`-compatible honesty checklist (a multi-position total grades `derived`, a lone position `exact` — unless clamping floored a negative value to $0, which is a transformation, not a copy, so it grades `derived` too). The WS4 **structural acceptance**: apply only ever writes `balance`/`costBasis` of selected, non-protected, non-duplicate accounts, in place, and never assigns a whole account shape — so a balance refresh *cannot* overwrite unrelated strategy assumptions (allocation, yields, contribution schedule, beneficiary, …) as a property of the code path rather than a review-time promise. **`protectedTargets`** is the Advisor seam: a caller-supplied path set enforced as one effective union across all three stages — classify snapshots it onto the classification, build unions that snapshot with its own argument and every `isProtected` candidate's target, apply unions the delta's record with its own argument — so protection supplied at *any* stage reaches enforcement even when apply is handed nothing, including for a target the user manually reassigned onto a protected account. A set supplied only at apply time is still honored, with a one-directional divergence: apply may skip writes the preview showed, never write more. The public planner panel passes no set; the Pro repo feeds it the WS2 intake decisions in a later dispatch. The Accounts screen's `UpdateBalancesPanel` now runs entirely on the engine — classification-driven default selections (`exact`/`likely` ON, `ambiguous`/`unmatched`/protected OFF), rendered before→after deltas per row, stale and duplicate callouts, apply routed through `applyRefresh` inside the plan `update` seam so `parsePlan` still gates saves — and its copy states the guarantee plainly. No existing API changed and the engine range stays `^0.1.6` (published), so no engine release is needed.
- Released **`@retiregolden/planner-ui` 0.4.6** (patch — scenario compatibility fix). Requires `@retiregolden/engine ^0.1.6` and uses its canonical scenario-patch rebind API whenever a plan receives a new identity: duplication, conversion from an example, and collision-rekeyed backup import. Canonical scenarios now keep their baseline preconditions aligned with the cloned plan id and remain applicable after those flows; unchanged-id imports and legacy loose patches retain their prior behavior. Tests cover duplicate, example-conversion, and import round-trips with real canonical scenarios.
- Prepared **`@retiregolden/engine` 0.1.6** (patch — additive scenario API). Adds the versioned `retiregolden.scenario-patch` contract: canonical typed operations with baseline preconditions and metadata, stable diff and composition, conflict-aware atomic apply/revert, legacy loose-patch compatibility and migration, safe plan-identity rebinding, and fail-closed path validation. Planner-ui adopts the new rebind API in the same wave and must declare `^0.1.6` after this engine release is published.

**2026-07-23**
- Released **`@retiregolden/planner-ui` 0.4.5** (patch — purely additive, source-only). Ships the **import-provenance contract** (advisor-intake WS1) on a new stability-promised subpath, `@retiregolden/planner-ui/import-provenance` — supported API, unlike the wildcard deep paths, so its envelope `kind`/`version` pair, exported names, and signatures only move on a semver-major. It answers, for every value an import mapper lands in a draft plan, where it came from and how faithfully it survived the trip: a **`SourceLocator`** union (`csvRow` / `jsonPath` / `form1040` / `derived` / `none`, with `sourceIndex` naming the file a leaf addresses in a multi-source import), an **`ImportConfidence`** grade (`exact` / `derived` / `estimated` / `assumed` / `unmapped`), a **`ReviewerDecision`** state (`pending` / `accepted` / `overridden` / `rejected`, a discriminated union so `overrideValue` exists exactly when the state is `overridden`), and a **`target`** engine plan path (`accounts[3]`, `household.state`) saying where the value landed. `ImportConfidence` is deliberately **not** the insights high/medium/low vocabulary: insights grades how strong a *finding* is, this grades how faithfully a *source value* was copied, and one enum for both would let a UI equate "we're confident this is a problem" with "we copied this number exactly". The versioned `retiregolden.import-provenance` envelope pairs `serializeImportProvenance` with `parseImportProvenance` (named failure reasons — `too_large` / `not_json` / `wrong_kind` / `unsupported_version` / `malformed`; unknown top-level fields tolerated so a host may extend it; a 10M-char cap that mostly guards against parsing the wrong huge file). It **never embeds a raw source document** — a source contributes only its file name, lowercase-hex SHA-256 of its **raw bytes**, byte count, and the mapper that read it, and the guarantee is structural rather than advisory because serialization rebuilds every object field-by-field, dropping anything a caller left attached. Hashing the raw `ArrayBuffer` (not decoded text) is what makes the digest match the file on disk, since decoding would normalize BOMs and invalid UTF-8 out of it; it lives alone in `import/sourceHash.ts` because `crypto.subtle` is the one piece that needs Web Crypto and is therefore async, letting `provenance.ts` stay browser-free and the four mappers stay synchronous and pure. All four mappers (`projectionLab`, `brokerCsv`, `genericCsv`, `tenForty`) now emit a locator, confidence, and target on every review item — additively; the human `source`/`detail` strings are unchanged — and `reviewToProvenance` folds a checklist into the envelope's `mappings`/`unresolved` buckets, deriving confidence from item status for producers predating the optional fields so a landed value is never graded `unmapped`. ImportPage gains a **"Download import report"** action; decisions stay `pending` in the free planner and are set later by the Pro/Advisor workbench. One privacy decision worth naming: the **guided 1040 path publishes no fingerprint at all** — there is no file, and a deterministic hash of low-entropy typed personal inputs (a DOB has ~36,500 plausible values) in a report meant for handoff would be dictionary-attackable, so `sha256` is the empty string, the contract's honest "nothing to verify against", never a wrong hash. No existing API changed and the engine range stays `^0.1.5`, so no engine release is needed.

**2026-07-22**
- Released **`@retiregolden/planner-ui` 0.4.4** (patch — additive, source-only). Added a shared **`PlanStore` contract suite** on the test-only subpath `@retiregolden/planner-ui/data/planStoreContract` (`describePlanStoreContract(label, factory)`). It pins the semantics every `PlanStore` implementation must share — anchored in the interface doc comments in `data/planStoreContext.ts`: `listPlans` returns `{ id, name, updatedAtIso }` summaries with order not significant; `loadPlan` returns the stored document verbatim (any `schemaVersion`) or `null`/`undefined` when absent; `savePlan` upserts keyed by the document's own `id` (saving twice leaves one entry with the later content and `updatedAtIso`); `deletePlan` removes, and deleting an absent id does not reject. Each consumer supplies a factory (fresh store per test + a valid plan-document builder + optional cleanup), so both the public browser store (`indexedDbPlanStore`, exercised by `data/planStoreContract.test.ts` over `fake-indexeddb`) and Pro's desktop library store run the identical behavioral contract. The module depends on `vitest` + local seam types only — no engine or adapter imports — and is deliberately **not** re-exported from `src/index.ts` (it reaches the wire only via the package's `"./*"` → `"./src/*.ts"` map). Purely additive: no runtime code or public API changed, so the engine range is untouched.

**2026-07-21**
- Shipped **"Copy plan for your AI"** in the free web app — Goal 2, and the last open item, of enhancement `mcp-agent-surface.md`. A button in the results toolbar copies the current plan to the clipboard as `{ plan, startYear, schemaVersion, engineVersion }`: the real engine plan document (not a summary), in the subset of the RetireGolden MCP's `export_plan` envelope the browser can honestly fill, so a pasted payload spreads straight into `build_plan`. With the MCP installed an assistant's tools ingest it directly; without it, a model still receives structured *inputs* it can reason about instead of the results ledger the CSV export gives it. Clipboard, not a download (a plan is a few KB; pasting is one action). No prose line above the JSON — that would break `JSON.parse`, so the instruction lives in the UI hint, next to a privacy note stating plainly that whatever the user pastes into sees the whole plan under their own account and that provider's terms. `startYear` is emitted deliberately: `build_plan` defaults to the literal 2026 while the planner projects from the current year, so an unstamped payload would agree with the app throughout 2026 and diverge silently on 2027-01-01 (the same bug class already fixed in Pro's connector). `conventions` is deliberately **absent** — not `null`, not `{}` — because the MCP's convention knobs are benchmark session overrides with no engine or browser meaning, and an empty object would assert a posture the user never chose. Format documented in `DOCS/features/plan-file-format.md`; the `CopyButton` lifted out of the assumptions card now reveals the text in a selectable field when the Clipboard API is unavailable, so a failure hands the data over instead of dropping it. A round-trip test in this repo (with `@retiregolden/mcp` as a **dev** dependency — the first dependency edge of any kind to that package, and nothing reaches the browser bundle) feeds a real copied payload to the real `build_plan` and asserts the plan, start year, and projection come back unchanged. Building it surfaced a cross-product bug and got it fixed the same day: MCP 0.4.2's `run_projection` ran a federal-only tax stack where the browser combines federal with the engine's modeled state pack, so an assistant reported different numbers than the screen for a resident of a modeled state (~13% of ending net worth on the sample KY couple — and note `stateEffectiveTaxPct: 0` means "use the modeled pack", not "no state tax"). Fixed in `@retiregolden/mcp` **0.5.0** ([MCP PR #18](https://github.com/RetireGolden/RetireGolden-MCP/pull/18)), which also adds a browser-parity test on the consumer side; the dev dependency here pins 0.5.0 and the round-trip test now asserts the MCP's own `run_projection` summary equals the browser's, so the parity is guarded from both ends. The engine-provenance assertion is written against the MCP's *installed* engine rather than blanket-asserting no skew: the MCP exact-pins an engine version, so between an engine release and the MCP re-pinning, a correctly-stamped payload legitimately raises the caveat — asserting it away would couple this suite to another repo's release cadence.
- Added an **`ENGINE_VERSION` export** to `@retiregolden/engine` — available as `@retiregolden/engine/version` and re-exported from the root. The engine already exposed `PLAN_SCHEMA_VERSION` for the *plan format* but nothing for its own release, so a document the engine produced could not say which build produced it. The immediate consumer is the free web app's forthcoming "Copy plan for your AI" export (enhancement `mcp-agent-surface.md`, Goal 2), whose payload stamps `engineVersion` so the RetireGolden MCP's `build_plan` can raise its provenance caveat — *defaults and modeling semantics can move between engine versions* — instead of letting a divergent projection look authoritative. It is **generated** from `package.json` into a checked-in constant (`npm run generate:version`, following the existing `generate:schema` precedent) rather than read at runtime: the engine ships into browser bundles, where the `createRequire` pattern the MCP uses has no resolver, no filesystem, and no `package.json` to read. A unit test re-reads `package.json` independently and fails if the constant is stale — load-bearing rather than ceremony, since no CI job runs the generators and these artifacts are otherwise kept current by discipline alone (the same gap already applies to the generated Plan JSON Schema). **Version:** engine bumped `0.1.4 → 0.1.5` (patch; additive export, within the `^0.1.x` range consumers declare). Unlike 0.1.3's additive export, this one has a consumer that *depends* on it in the same wave: `@retiregolden/planner-ui` adopts `ENGINE_VERSION` in a follow-up PR and tightens its range to `^0.1.5`, so **0.1.5 must be published before that planner-ui release** — its registry-based pack-smoke cannot resolve the range until then. Releasing the engine on its own first is exactly the independence the additive-patch discipline is meant to preserve. **Not yet published** — the owner tags/publishes releases.
- Released **`@retiregolden/planner-ui` 0.4.3** for the export above (patch — additive `serializeSinglePlan` on the stability-promised `plan-format` subpath, plus the shared `CopyButton`). Its engine range tightened `^0.1.0 → ^0.1.5`: planner-ui now *depends* on `ENGINE_VERSION` rather than merely tolerating it, and the caret was not expressive enough to say so. **Engine 0.1.5 must therefore be published before planner-ui 0.4.3** — the registry-based pack-smoke cannot resolve the range until it is. That is why the engine export shipped as its own release first; see its entry above.

**2026-07-20**
- Added exact pre-projection MAGI history for IRMAA's two-year lookback. Plans may now provide optional year-keyed `historicalAnnualMagiByYear` values; a matching year takes precedence over `recentAnnualMagi`, which remains the backward-compatible fallback for older saved plans. This removes the prior first-two-projection-year ambiguity when consecutive historical tax returns have different MAGIs. The generated Plan JSON Schema and boundary tests cover the new input. **Version:** engine bumped `0.1.3 → 0.1.4` (patch; additive plan input). **Not yet published** — the owner tags/publishes releases.
- Added a **versioned Plan JSON Schema export** to `@retiregolden/engine` (enhancement `plan-ingestion-and-round-trip.md`, step 2; additive, no change to `planSchema`/`parsePlan`/any existing behavior). The engine now *derives* a JSON Schema (draft 2020-12) from `planSchema` with zod 4's `z.toJSONSchema({ io: 'input' })` — describing what `parsePlan` accepts, so a downstream AI client (the forthcoming MCP `describe_plan_schema` tool, built separately in RetireGolden-MCP) can learn the plan format and author a plan from a user's account statements. New surface: a `./schema` subpath exporting `planJsonSchema`, `PLAN_SCHEMA_VERSION`, `PLAN_SCHEMA_ID`, `PLAN_SCHEMA_UNREPRESENTABLE_CONSTRAINTS`, and `generatePlanJsonSchema()`. The schema is kept off the minimal root entrypoint so importing `simulatePlan`/`planSchema` never eagerly evaluates the ~130 KB schema constant. It ships two ways: a compiled constant and a checked-in static `schema/plan.v1.json` (in the npm `files`) for offline, no-import reads. Build-time generation via `npm run generate:schema` writes both from one generator (with a version-path guard that fails a future schema-version bump until the versioned artifact paths are updated); a sync test fails CI if the artifact drifts from `planSchema`. Discriminated unions (accounts/incomes) map to `oneOf` and the `schemaVersion` literal is preserved; cross-field refinements JSON Schema can't express (id references, funding rules, allocation weights summing to 100%, year-window ordering, …) are dropped by `z.toJSONSchema` and are therefore enumerated in `PLAN_SCHEMA_UNREPRESENTABLE_CONSTRAINTS` and summarized in the schema `description` — the structural schema is necessary but not sufficient, and `parsePlan` remains the full validator. Tests cover fixture parity (every parsePlan-accepted fixture, plus a kitchen-sink plan, validates via ajv), a pointed-path failure on a wrong-typed/missing field, the version, and schema↔planSchema sync. **Version:** engine bumped `0.1.2 → 0.1.3` (patch). The change is additive and stays within the `^0.1.0` range `@retiregolden/planner-ui` and the web app already declare, so the engine **releases independently** (as 0.1.1/0.1.2 did) and consumers pick it up on their next resolve — no coordinated planner-ui release and no workspace/registry version skew. (A strict-semver reading would treat a new export as a minor; a minor would force `^0.2.0` range bumps across planner-ui and the app and would fail their registry-based pack-smoke checks until engine 0.2.0 is actually published, so the additive change ships as a patch instead.) **Not yet published** — the owner tags/publishes releases.
- Migrated npm publishing to **Trusted Publishing (OIDC)** with a manual-approval gate (PR #32): both package workflows now authenticate via GitHub's OIDC token instead of the long-lived `NPM_TOKEN`, pin npm to `^11.5.1` for OIDC support, and run the publish job in the `npm-publish` environment (required reviewer plus an `engine-v*` / `planner-ui-v*` tag deployment policy). Provenance is still generated automatically; a `guard` job keeps manual dispatches dry-run-only.
- Released **`@retiregolden/engine` 0.1.2** to npm (patch — bug fixes, no API changes): graceful handling of tax-solver discontinuities, a fix to the tax-withdrawal fixed-point convergence, and the SC H.4216 / ME 2026 state-tax corrections (ORACLE-016/017 kept outside the SCIAD and ME deduction phase-outs) backed by external oracle fixtures. 0.1.2 is eligible under the `^0.1.0` range — a fresh resolve selects it; consumers with a pinned lockfile pick it up on their next update.
- Released **`@retiregolden/planner-ui` 0.4.2** to npm (patch — no API changes): rebaselined the projection characterization goldens to track the engine 0.1.2 tax fixes, and cleared a Semgrep XSS false positive in the pack-smoke script.

**2026-07-17**
- Released **`@retiregolden/engine` 0.1.1** to npm (patch — corrected data, no API changes): the GA 2026 rate/deduction fix (4.99% / $15,000–$30,000, DOR vintage), the full 2026 state-pack staleness sweep (legislated rate changes in IN, MS, MT, NE, NC, OH, OK, NY; Missouri's HB 594 individual capital-gains exemption; ME/SC 2026 rewrites from PR #23 review — ME decoupled deduction + 2% surcharge, SC H.4216 SCIAD + 1.99%/5.21%; federal-conformed standard deductions aligned to the 2026 federal figure), and the re-anchored SPIA payout-rate planning table. Patch semantics chosen deliberately: `^0.1.0` consumers pick up the corrected 2026 math automatically.

**2026-07-09**
- Shipped survivor & widowhood transitions + IRMAA relief (market-research Tier 2.1; all four steps of `DOCS/enhancements/survivor-widowhood-and-irmaa-relief.md`; feature-off proven byte-identical — `cases:diff` vs main shows no case deltas):
  - **SSA-44 IRMAA redetermination (opt-in)**: `expenses.healthcare.ssa44` models Form SSA-44 relief after a qualifying life-changing event — a couple's first death, and optionally each person's retirement (work-stoppage) year. In the two premium years after an event (the years whose two-year lookback still references pre-event income), IRMAA MAGI = min(lookback, prior-year) — the prior year is the documented planning-grade stand-in for the current-year estimate (same convention as the ACA credit), and the min encodes that a redetermination is only filed when it helps. The Roth optimizer prices it in-solve: flagged premium years shift their IRMAA-binary source from year (t−2) to (t−1) (probe → `OptimizerYear.ssa44Redetermination`), a conservative single-source stand-in the exact-ledger tournament refines. New Spending → Healthcare toggles; new per-year `medicarePremiums` + `irmaaTier` reporting fields on `YearResult`; fixtures cover survivor and retirement windows, never-raises-a-premium, the optimizer LP source shift, an economic solve case, and feature-off byte-identity. Domain rules §7 documents the treatment.
  - **Survivor transition view** (`/plan/:id/survivor`, Explore rail, couples-only): sweeps earlier first-death timings (ages 70–90, either spouse first) by re-running the user's own plan with `deathAgeByPersonId` overrides on the same deterministic ledger as Results — filing-status timeline, survivor Social Security step, tax on similar MAGI across the transition, IRMAA with/without SSA-44 (tier and premium delta per window year), survivor spending coverage (shortfall years + investable low point), and the convert-while-joint lever (the detector's fill-the-12%-bracket patch priced as an ordinary scenario). A one-click callout can turn SSA-44 modeling on when timings show unmodeled relief. `planner/survivorAnalysis.ts` is pure and test-guarded to agree exactly with hand-run scenarios; educational framing throughout (timings are chosen scenarios, never predictions).
  - **Detector upgrade**: `widows-penalty-roth` keeps its original screens and now quantifies the survivor bracket jump on the plan's own first survivor year (same MAGI priced single vs joint, today's dollars) and points at SSA-44 when survivor-window premiums land in a surcharge tier the plan isn't relieving; the conversion-acceleration preview scenario is unchanged and still priced on the exact ledger.
  - **Learning Center**: new `appealing-irmaa-ssa-44` article (Healthcare, sourced to SSA/Medicare.gov) wired to the new field, the survivor view, and the widow's-penalty detector; the existing `widows-penalty-and-survivor-brackets` article extended with the Medicare/IRMAA row, SSA-44 cross-links, and the new view's route.
  - **QSS/IRMAA correctness fix (from PR review)**: qualifying-surviving-spouse years now price Medicare premiums on SSA's **individual** threshold table (POMS HI 01101.020 groups QSS with single/HOH) instead of the joint table the income-tax mapping uses — previously QSS survivor years could understate IRMAA. Results-moving only for plans with `hasQualifyingDependent` whose survivor-year lookback MAGI lands between the single and joint thresholds (`cases:diff` clean — no example plan does).
- Shipped the state-relocation compare ("where should I retire?" on your real plan; market-research Tier 2.6, steps 1–3 of `DOCS/enhancements/state-relocation-compare.md` — read-only sweep over shipped machinery, no schema change):
  - **Relocation Compare page** (`/plan/:id/relocation`, Explore rail): pick up to 5 candidate states (optional split-year move year, optional flat local rate, optional flat cost-of-living spending delta) and run the user's actual plan once per candidate in a Web Worker (`engine/projection/relocation.ts` + `src/relocation/`). Rows rank by lifetime state+local tax, lifetime taxes & penalties, ending after-tax estate (today's dollars), and a Monte Carlo success rate on **shared market paths** (same seed/model per row, so path N is the same market history in every state). Each candidate is expressed as a scenario patch over the existing `household.state`/`stateMoves`/assumptions fields — proven **byte-identical to manually editing the plan's state**, and "Add as scenario" round-trips to exactly the row the sweep ran. Candidates clear a flat state-rate override (it would mask the modeled packs); the UI calls this out, states the income-tax-only scope prominently (property/sales/COL/healthcare named as out of model), and never recommends a "best state".
  - **Per-state driver drill-down**: the sweep records the ledger's final per-year state-tax lines through the production calculator, then re-prices each year with one state rule neutralized at a time through the identical code path (new exported `computeStateTaxYearTotal` with a params hook) — attributing lifetime state tax to SS treatment, retirement-income exclusions (shared-rule vs separate public-pension bucket surfaced distinctly), and capital-gain treatment, with a runtime reconciliation guard proving the unmodified recomputation matches the ledger's lines exactly.
  - **`state-relocation` detector upgraded** (screen conditions preserved): `evaluate()` now runs the same deterministic sweep over a zero-income-tax shortlist (FL/TX/WA), quantifies the lifetime state-tax drag in today's dollars, and previews the top candidate as a scenario — copy reframed neutrally ("worth a look", income tax is one factor). The Learning Center article ("what actually changes when you move states") is dispatched separately (Codex).
  - CA→FL vs CA→PA public-pension fixture proves the pension-exclusion driver surfaces (PA's shared full exclusion vs NY's separate public-pension law), move-year candidates match manual split-year edits, deterministic metrics are seed-stable, and `sharedPaths` gained per-entry tax calculators for per-candidate local rates. Full suite green (1,603 tests, +11 new).

**2026-07-08**
- Shipped annuity depth v2, pension lump-sum, and home-equity (HECM) decisions (market-research Tier 2.3 + 2.4 + 2.5; all five steps of `DOCS/enhancements/annuity-pension-and-home-equity-decisions.md`, additive/no-op-default throughout — plans that use none of it are byte-identical):
  - **Annuity payout forms + ladders**: `payoutForm` on annuity accounts — life-only (default), life with N-year period certain (guaranteed payments continue to the household if the owner dies inside the window), and joint & survivor (a chosen share continues to the other household member for life). Non-qualified exclusion-ratio taxation extends per form (IRS Pub 939 General Rule): period certain floors the expected-return multiple at the guarantee; joint & survivor decomposes by expectation over the SSA-derived joint last-survivor expectancy (documented planning-grade approximations of Pub 939 Tables III/VI/VIA, hand-worked method fixtures). Annuity ladders (multiple dated purchases) are first-class, and the purchase candidate generator gained a laddered SPIA candidate (three tranches at now/+3y/+6y).
  - **Annuitization sweep ("how much to annuitize?")**: `buildAnnuitizationSweep` runs a bounded 0–30% allocation grid through the shared-path Monte Carlo primitive — each point trades that share of investable assets for a life SPIA priced from a new sourced payout-rate planning table (`engine/decisions/spiaQuotes.ts`; user quotes override) — and reports the success-vs-legacy frontier on the Monte Carlo page's Frontier views. Kitces glidepath attribution: allocation-matched controls (the premium shifted bonds→stocks *without* buying the annuity) isolate the implicit rising-equity-glidepath share of the benefit from what annuitization adds beyond it.
  - **Pension lump-sum vs annuity decision**: pensions can record a `lumpSumOffer` (amount + election year) and an optional `lumpSumElection`; electing commutes the pension — a tax-free direct rollover into a chosen traditional account in the election year, priced by the ledger. The Accounts section gains a decision view: the annuity's PV at a curve-anchored discount rate (TIPS real yield + inflation), the survivor option's PV value, and a discount-rate × longevity sensitivity table (hand-worked PV goldens) — framed as tradeoffs, never advice. `pensionLumpSumGenerator` supplies the keep-vs-take scenario pair to the decision engine.
  - **HECM line of credit (buffer asset, Pfau)**: opt-in on a primary residence — line sized by the lender quote or the pack's published HUD principal-limit factors (5.875% expected rate, 2026; provenance id `hecm-plf`), the unused line and the loan balance both compounding at the entered growth rate (default 7.5% = rate + MIP), financed upfront costs, and two draw policies: coordinated (draw tax-free for spending in the year after a negative market return, letting depressed assets recover) and last-resort (draw only when the portfolio is exhausted); any open line backstops a true shortfall. Non-recourse honored end to end: sale payoff never exceeds the proceeds, and net worth/estate cap each loan at its home's value. New `hecmDraw`/`hecmLoanBalance` year fields; a deterministic crash-then-recover fixture reproduces Pfau's coordinated > last-resort > no-HECM direction.
  - **Insights detectors**: `annuitization-headroom` (planning to 95+ with liquid savings and no lifetime income beyond SS), `pension-election-pending` (undecided offer, quotes the PV comparison), and `hecm-buffer-candidate` (house-rich/portfolio-thin at 62+) — each previewing a ledger-priceable scenario. Learning Center articles are dispatched separately (Codex).
  - Substance folded into domain rules §19; SPIA payout table and HECM PLF refresh cadence added to the maintenance schedule. Full suite green (1,550 tests at ship, +46 new).
- Shipped spending paths, SWR lenses & longevity-as-a-distribution (market-research Tier 2.2/2.7/2.8/2.10/2.11; steps 1–5 of `DOCS/enhancements/spending-paths-and-swr-lenses.md` — the Learning Center cluster, step 6, remains open for Codex). All opt-in; feature-off plans proven byte-identical (`cases:diff` vs main shows no case deltas):
  - **Spending-shape presets** (`engine/spending/shapePresets.ts`, Spending screen): constant-real, retirement smile (shipped calibration unchanged), new retirement **smirk** — Blanchett's *median* retiree, a steady −1%/yr real decline with no late uptick, compiled as compounded 5-year phase steps to age 100 — front-loaded travel, and a **custom annual real delta**, all writing ordinary editable `expenses.phases` rows at creation time (no schema bump, anti-drift). The "How much can I spend?" page gained a **solve-per-shape** view quantifying the shape-aware initial-spending uplift on the user's own plan; a solver fixture proves the smirk uplift direction.
  - **Amortized spending (ABW)** — the Bogleheads-formalized amortization-based-withdrawal family (VPW/TPAW/CAPE rules are members) as a new opt-in spending policy (`expenses.spendingPolicy.mode = 'abw'`; pure math in `engine/spending/abw.ts`): each year the recurring lifestyle target is the actual start-of-year portfolio re-amortized over the remaining horizon (annuity-due, matching the ledger's spend-then-grow timing; the payment ratio is inflation-invariant). Parameters: expected-return source (fixed real %/yr with a one-click **VPW preset** at 3.8% — the VPW wiki's global stock/bond IRRs weighted 60/40 — or a CAPE earnings-yield blend, or a TIPS real yield) × horizon (planning age or the 25%/10% survival-percentile age, joint for couples) × spending tilt. Healthcare, debt, property, insurance, and one-time goals stay separately modeled on top; the payment funds through the normal tax cascade. Fixtures prove the amortization identity (exact depletion at the horizon under realized = expected returns) and the tax cascade; per-path re-amortization works unchanged under Monte Carlo. The Monte Carlo "Adjustment outlook" card is now correctly scoped to the two guardrail modes (ABW re-amortizes instead of cutting), and the HTML report summarizes the ABW policy.
  - **"Whose 4% rule?" SWR comparator** (`engine/decisions/swrComparator.ts`, on the "How much can I spend?" page): Bengen 2025 (4.7%, *A Richer Retirement*), Morningstar 2026 (3.9%, *State of Retirement Income*), and the ERN CAPE rule (1.75% + 0.5 × 100/CAPE) each priced on the user's own plan with one deterministic exact-ledger run (same-path deltas by construction), with citations, next to the plan's own solved answer expressed as a rate — published rules of thumb vs. the plan-specific number, none endorsed.
  - **Survival-percentile planning ages** (`engine/montecarlo/survival.ts` + a Household-screen "Percentile" picker): planning age as "the age I/we have a 25% (10%) chance of reaching" — single and joint ("either of us", independent lifetimes) — from the same SSA 2022 q(x) derivation the stochastic-longevity engine uses, with an optional proportional-hazards health adjustment converted from the saved longevity questionnaire's multiplier (the Actuaries Longevity Illustrator pattern, no second factor set). The picked age writes once with provenance (`longevity.source = 'percentile'` + the pick spec, shown on the assumptions card); never silently recomputed; fixed-age plans unchanged.
  - **Bucket reporting lens** (`planner/bucketLens.ts` + an opt-in Results card, off by default): the projected balances re-read as time-segmented buckets — "the next N years of net spending" (spending + taxes − income, floored at 0; classic 2yr/8yr/growth and 3yr/growth presets) — reconciling to the ledger's investable total every year by construction, with the honest Estrada/Kitces evidence note: buckets are reported, never managed; the plan stays invested (and simulated) total-return.
  - Model additions are all optional-with-defaults (no schema version bump): `spendingPolicy.mode: 'abw'` + `spendingPolicy.abw`, `longevity.source: 'percentile'` + `longevity.percentile`, and an exported `ExpensePhase` type. Ground truth folded into domain rules §14 ("Spending paths & SWR lenses") and features/README §1/§4.
- Shipped the Social Security bridge & TIPS-ladder income floor (market-research Tier 1.4 + 1.5 + funded-ratio hook 2.9; all six steps of `DOCS/enhancements/social-security-bridge-and-tips-ladder.md`):
  - New pure `engine/ladder/` module: back-to-front rung solve for a level real income (the tipsladder.com construction), curve-interpolated par-TIPS pricing, `realPresentValue` on the TIPS curve, SS bridge sizing (`bridge.ts`), and the funded ratio (`fundedRatio.ts`). Golden-tested against the level-annuity identity and the mid-2026 regime claim (30-year ladder at ~2.7% real supports ~4.8–4.9% real SWR).
  - TIPS ladders as plan artifacts (`plan.incomeFloor.ladders`, additive/optional — no migration): purchase funding transfers the quoted cost out of cash/taxable (realizing gains pro-rata, scaling down with a warning when short), and cash flows run inside the ledger with real TIPS taxation — coupons + annual inflation accretion (phantom OID) are federal ordinary income including NIIT, **exempt from state tax** via a new universal `TaxYearInput.usGovernmentInterest` field (31 U.S.C. §3124; honored by modeled packs, split-year proration, and the flat-override path); maturing principal is a tax-free return; unmatured face rides in `YearResult.ladderValue` → net worth. New `incomes.tipsLadder` category flows through Results charts and the ledger CSV.
  - SS bridge as a one-click artifact: a bridge panel on the Social Security Optimizer sizes each claimant's bridge (forgone age-62 benefit × retirement→claim gap years, the BPC framing), quotes the TIPS ladder, adds it to the plan, and prices "claim at 62" vs "delay" vs "delay + bridge" on the same deterministic ledger and the same 500 seeded Monte Carlo paths. `bridgeLadderGenerator` proposes bridge/no-ladder candidates to the decision engine (category `guaranteed-income`).
  - Funded-ratio card (Pfau's household pension-accounting lens) on Results and the new **Income floor** planner page: required-floor spending vs guaranteed income (SS, pensions, annuities, ladders), both read from the same projection years, deflated, and discounted on the embedded TIPS curve — plus the unfunded-gap PV.
  - New Insights detectors: `ss-bridge-gap` ("your gap years are unfunded — preview a sized bridge as a scenario") and `income-floor-funded` ("your floor is X% funded", advisory).
  - Embedded Treasury real-yield curve snapshot (`params/data/realYieldCurve2026.ts`, provenance id `real-yield-curve`, annual refresh cadence in the maintenance schedule, "curve as of" label on every quote). Opt-in FedInvest CUSIP price fetch (`engine/ladder/fedInvest.ts`) — the app's only outbound network request, explicit-click only, day-cached in localStorage, CSP `connect-src` opened to treasurydirect.gov only; because FedInvest sends no CORS headers the UI degrades gracefully and offers a zero-network `securityprice.csv` import fallback (CSV format verified against the live endpoint).
  - Three Learning Center articles (`tips-ladders`, `social-security-bridge`, `funded-ratio`) wired to detector cards and field help.
  - Feature-off proven byte-identical: full suite green (1,433+ tests incl. new ladder/ledger/state-tax/detector/generator fixtures covering both inflation regimes) and `cases:diff` vs main shows **no case deltas** across the example library.
- Shipped onboarding imports & cross-tool migration (all six steps of the enhancement plan; UI + pure client-side mappers, no engine change):
  - Export-format hardening: the plan backup JSON is now a documented contract (`DOCS/features/plan-file-format.md` — envelope, schema versioning, migration guarantees, round-trip exactness, unknown-field handling) enforced by tests: every example-library plan round-trips serialize→parse exactly, a pinned full-featured v1 export must stay importable forever (CI fails if a schema change would strand old backups), and the docs-consistency suite pins the documented versions to the code.
  - New `/import` wizard ("Import from a file" on the planner home) with four guided paths, each producing a draft plan through the same validated route as backup import, behind a shared review checklist (Imported / Assumed — review / Not imported / Skipped) so nothing imports silently: broker positions CSV (Schwab section format, Fidelity account-column format, Vanguard holdings download; balances + cost basis where present, account types guessed from labels with visible review items), ProjectionLab JSON export (accounts/income/spending/milestone mapping, version-sniffed, format drift refused with a helpful message), generic spreadsheet/RPM CSV (header detection + per-column role guesses with a manual column-mapping step), and a 1040 guided seed (~12 typed line values → filing/state/household, wages, an explicitly-estimated taxable account from interest/dividends at an assumed yield, pension, SS benefit basis, and the IRMAA-lookback MAGI; no PDF/OCR — deferred by design).
  - Accounts screen: "Update balances from a broker CSV" panel for returning users — assign each account found in the file to a plan account and refresh balances (and taxable cost basis) without retyping.
  - Security: all imported files treated as hostile input (hardened RFC-4180 CSV core with size/row/column caps, every number through a strict money parser, JSON caps, formula/markup strings kept inert) with adversarial test suites per mapper, à la the SSA XML importer.
  - Learning Center: "Moving to RetireGolden" and "Seed your plan from your tax return" (Using RetireGolden), wired to the new route; sustainability statement now points at the format contract.
- Shipped the trust & transparency layer ("show your work"; additive UI over existing evidence payloads, no engine change):
  - Per-plan assumptions card at `/plan/:id/assumptions-card` (linked from Results and Assumptions): every live assumption — economy, per-account returns/allocations, longevity, law toggles, strategy settings, and the parameter pack — tagged user-set / app default / published source, with "Copy as text" and "Copy as JSON" exports (the JSON round-trips the assumption values shown on the card exactly; the remaining plan inputs travel in a plan backup).
  - "Why this number?" explainer panels: Monte Carlo success % (what it counts, model/seed/precision, depletion-year trace, first-decade p10-vs-median sequence sensitivity), the optimizer recommendation (objective, winner, margin over runner-up and over the solver's schedule, plus a table of every beaten alternative with dollar margins from the exact-ledger tournament), and the spending-solver answer (bisection method, binding constraint, simulation count).
  - Cite-the-authority tooltips: field ⓘ bubbles can now carry a `source` link to the parameter's provenance entry (IRS/CMS/SSA etc.), wired to the conversion fill-target, QCD, recent-MAGI, state-override, and trust-fund-cut fields.
  - Asset-location invariance, proven: new fixture suite `engine/decisions/assetLocationInvariance.test.ts` (green — no defect found) shows a zero-tax conversion between identically-allocated accounts leaves every year's totals identical, the estate benefit is exactly the heir-tax term, and conversion candidates can never smuggle in an allocation change; public claim added to the methodology posture note.
  - In-app "How RetireGolden is tested" page at `/how-tested` (linked from Results and the Disclaimer): one-auditable-ledger story, external-oracle suites with build-time (glob-derived, never-stale) counts, the optimizer parity-harness summary, golden/regression gates, and the deliberate simplifications stated as prominently as the strengths.
- Shipped risk-based guardrails & probability-of-adjustment reporting (market-research Tier 1.2 + 1.3):
  - New `riskBasedGuardrails` spending-policy mode: spending adjusts when the real portfolio balance crosses dollar thresholds solved from the user's target probability-of-success band (default 70–95%), instead of the withdrawal-rate ratio. Same discretionary rationing machinery as G-K; the required floor is never cut; unsolved thresholds leave the mode inert.
  - Shared-path threshold solver (`engine/montecarlo/riskBasedGuardrails.ts`): bisection over the starting-balance scale on identical seeded Monte Carlo paths finds the balances matching the band edges and sizes the $/mo cut/raise that restores the band midpoint; runs on demand in a worker from Spending and persists the thresholds on the policy.
  - Adjustment-outlook reporting for any guardrail plan (`MonteCarloSummary.adjustments` + Monte Carlo card): P(any cut), median/p90 deepest cut, average/p90 cut years, longest cut spell, P(raise), P(ending surplus), and P(estate clears the bequest target) — the Kitces "probability and magnitude of adjustment" framing alongside the classic success %.
  - Surfaces: Spending mode picker + band fields + solve button with dollar readout, Results risk-based guardrail callout + `guardrailFactor` CSV column, report spending-policy summary line, insights detector/safe-spend generator treat risk-based plans as already guardrailed, `risk-based-guardrails` Learning Center article, domain rules §14 entries.
  - Fixtures: solver band-reproduction/determinism tests, ledger integration tests, and a 2007-retiree historical-sequence fixture demonstrating the G-K vs risk-based cut-depth delta. Plans without guardrails are byte-identical (regression-tested).
- Shipped the ground-truth 2026 law & oracle sync (Tier 0 of the July market research; three verifications, one real gap found and fixed):
  - **Correction — OBBBA senior deduction now priced in-solve by the Roth optimizer.** The $6k/person (65+) deduction and its 6%-of-MAGI phase-out ($75k/$150k thresholds, 2025–2028) were in the tax ledger but invisible to the MILP: the optimizer left ~$6k/person of cheap-bracket conversion headroom unused in those years and undercharged conversions inside the phase-out band (true marginal rate = bracket × 1.06). Now modeled as a deduction constant plus a convex phase-out floor (same pattern as the taxable-SS phase-in PWL), always on in production, byte-identical LP when absent. A new optimizer fixture proves the phase-out flips a marginal conversion; the trad-heavy characterization fixture's exact after-tax estate improved ~$1.2k, and the example-plan library shows no case deltas (`cases:diff`).
  - **Correction — Social Security trust-fund default updated to the 2026 Trustees Report.** The 2026 report (June 2026) projects combined OASDI depletion in Q3 2034 with **83% of benefits payable**, so the haircut toggle default `TRUSTEES_DEFAULT_SS_HAIRCUT` moved from 19% to **17% from 2034** (single definition site; `ScenariosPage` literal defaults now import it). Learn articles and DOCS citations updated; the OASI-only figures (2032, 78% payable) are documented alongside.
  - Owl parity harness re-pinned from `f0c3942d` to `f09b4022` (tag `v2026.07.04`, Owl's current release) in both the TS manifest and the Python runner; `npm run owl-parity -- --install-owl --strict-owl` regenerated and the gate **passes on every fixture** — margins +$98 (high-tax state, narrowed from +$3.0k by Owl's newer release) to +$141.4k (balanced low-basis couple). Competitive analysis, optimizer feature doc, and external-oracle-comparisons updated.
  - (The fourth Tier-0 item, the 2026 ACA applicable-percentage verification, had already been completed by the hardening plan.)
- Shipped the UI/UX critique remediation (site-wide product-quality pass; UI/copy/CSS only, zero engine deltas):
  - Insights surface rebuilt on the design-system tokens/classes (no more inline-style island, undefined CSS variables fixed and guarded by a static test, SVG icons, theme-aware badge tints).
  - All native `window.prompt`/`confirm`/`alert` call sites replaced with in-app dialogs on the shared Modal; "Clear all data" now requires typing `delete` and offers a one-click backup first.
  - Monte Carlo model picker: 3 plain-language presets (Smooth randomness / Replay real history / Stress test) + an "Advanced models" disclosure holding the full 15-model catalog; byte-identical configs per seed (wiring-tested); competitive tooltip copy removed.
  - Copy clarity: "exact-ledger", "patch", and machine labels removed from user-visible strings; bad Monte Carlo verdicts now carry a handrail linking to Insights and "How much can I spend?".
  - Accessibility: WCAG AA contrast in light/dark/toggled-dark (accent `#0C8F66` → `#0B7A56`; token-computed contrast test), valid plan-card ARIA (no nested-interactive), aria-live save indicator, authored `:focus-visible`, chart text alternatives.
  - Mobile: ≥44px effective touch targets on coarse pointers, single-row scrollable KPI bar at 375px, scrollable rail chip strip, and a compact no-hamburger header.
  - KPI plan-completeness state: half-entered plans show "Getting started" instead of a red depletion verdict; red KPI values and the Results depletion notice link to Insights.
  - Polish: shared stat-tile classes replace inline styles, Learn reading measure tightened, reduced-motion coverage extended, transform-based progress fill, disclaimer de-duplication (app footer is authoritative).
- Completed the surpass-Owl program (Track 1 Steps 2-6 + convergence loop): in-LP taxable-gain realization, bracketed state tax and the taxable-SS phase-in PWL, IRMAA two-year lookback in-solve, co-optimized SS claim age, windowed bracket-fill candidates, and top-two search refinement. `npm run owl-parity` now passes on every fixture (RetireGolden beats pinned Owl by +$3.0k to +$141.4k of exact after-tax estate).
- Exposed the opt-in "Also optimize Social Security claim age" toggle on the Optimize tab; a winning claim change and its conversion schedule apply atomically.
- Added the UI/UX critique remediation enhancement plan (shipped the same day; see above).
- Restored docs clobbered to one-line placeholders by 2026-07-07 docs commits (4413fc1/b56b2a3): `DOCS/features/social-security.md`, `DOCS/enhancements/gap-analysis-closeout.md`, `DOCS/enhancements/assumptions-deep-dive-and-learning-center.md`, and `DOCS/enhancements/early-investing-and-fire.md` (re-applying their intended retired-`gap-analysis.md` reference edits); synced feature-doc ground truth (MC model library, example-library count, optimizer index summary).
- Shipped codebase hardening & drift repair (all five phases of the desloppify remediation plan):
  - Verified the 2026 ACA applicable-percentage table against IRS Rev. Proc. 2025-25 (values were already correct; provenance now cites the Rev. Proc. and the maintenance schedule tracks the annual check).
  - Autosave now flushes on `pagehide`/`visibilitychange` (closes the tab-close/PWA-kill data-loss window); Monte Carlo and SS-analysis worker failures surface error banners instead of stuck spinners; the spending chart's duplicate category color fixed with a new `--chart-8`.
  - Delivery/offline: Examples and Compare are lazy routes (entry chunk 1,005KB → 822KB), the 3MB HiGHS WASM and Learn images are runtime-cached (optimizer + read articles work offline), header logos shrunk 385KB → 12KB each, and `npm run build` now generates `sitemap.xml` (129 URLs) referenced from robots.txt.
  - Enforcement: CI test job runs coverage thresholds; new Playwright smoke suite (persistence roundtrip, Results/Monte Carlo render, backup export→clear→import, lazy routes).
  - Structure: 2,850-line `sections.tsx` split into `planner/sections/` behind a barrel; `engine/socialsecurity` merged into `src/socialSecurity`; `TRUSTEES_DEFAULT_SS_HAIRCUT` centralized in `engine/params`; money formatter, chart tooltip style, worker promise wrapper (`workers/run.ts`, with sibling-termination on pool failure), and guarded localStorage access (`data/localStore.ts` + `STORAGE_KEYS`) each deduplicated to one home.
  - Docs/dead code: code-map/README/index.html-meta drift repaired (with a new docs-consistency test), dead v1 CSS selectors removed, `samplePlan` moved to `testSupport/`, planStore list pipelines folded.
  - Engine output verified byte-identical to `main` via `npm run cases:diff` (no case deltas).

**2026-07-07**
- Closed remaining July gap items (G1-G2, G4-G7; G3 asset-location surfacing intentionally limited to Insights detector).
- Docs sync: ground-truth DOCS updated to match all shipped July enhancements.
- Merged local case runner + self-contained HTML report export (`npm run cases`, report downloads with assumptions/provenance/ledger/optimizer evidence).
- Shipped stochastic frontier & risk metrics (after-tax estate percentiles, depletion prob, expected shortfall, spending shortfalls; frontiers + historical stress).
- Shipped guaranteed-income & estate depth (annuity purchases SPIA/QLAC, per-account beneficiaries with heir tax class + charity, survivor reserve, `annuityPurchaseGenerator`).
- Shipped account/HSA/fixed-asset depth (accountEligibility service, HSA medical sub-ledger + reimburse, nondeductible IRA basis/pro-rata, fixed asset §121 + tax fields, safety-net floor).
- Shipped asset allocation & return model v2 (4-class opt-in allocation + glidepaths + rebalancing + taxable realization; class yields for drag; MC class-correlated shocks; `assetLocationGenerator`; editable Assumptions table).
- Shipped social-security survivor precision (family-max cap on auxiliaries, ARF credit to spousal/survivor, claim-month proration, SS optimizer using shared exact-ledger + objective ranking).
- Various review fixes, guardrail patch hardening, and CI/docs chores.
- Added 8 new A/B example plans (4 feature demonstrations + 4 matched controls) to the Example Library, plus Learning Center articles, to make it easy to test the July depth wave features (guardrails, annuities+estate, allocation+glidepaths, HSA+fixed-asset depth) via Compare Plans and the case runner.

**2026-07-06**
- Shipped spending guardrails + flexible goals (required/target/ideal/excess layers, movable/skippable/fixed one-time goals with windows/priority/partials, Guyton-Klinger guardrails protecting required, MC metrics, Insights preview actions; additive schema).
- Shipped sustainable spending & objective modes (survivorSpendingPct, bequestTargetDollars feeding estate floors, spending profile presets, SpendingSolverPage + solver worker, objective policy selector + ranked tournament, headroom detector).
- Shipped tax & income-coverage depth (AMT planning-grade, localIncomeTaxPct, death-year MFJ + QSS, state CG conformity metadata for select states, income-coverage fixture/checklist for recommendation trust).
- Asset allocation, tax depth, guardrails, and sustainable PRs landed with reviews.
- Added difficulty/risk scores to enhancements index.

**2026-07-05 to 07-02**
- Shipped ledger-native decision engine core (shared CandidateGenerator / evaluate / tournament / objective policies / generators seam used by Optimize, SS analysis, Insights, spending solver).
- Shipped Roth/tax optimizer exact-ledger post-processor + validation (MILP trim + exact-ledger tournament arbitration for recommendations; beneficial/neutral/rejected states).
- Shipped tax/brokerage/healthcare depth gaps (ACA proration, pension buckets, split-year moves, taxable drag with yields).
- Planning-depth clean-room roadmap closed out and dispatched.
- Strategy/Spending/Insurance Learning Center audit + links shipped.
- Home page redesign (adaptive welcome + paths + examples).
- Example plan library at /examples.
- Early investing & FIRE support (time-phased contributions + salary growth + match, FI metrics, new examples + LC category).

## 2026-06

- Groundwork for decision engine, insights detectors, and objective policies.
- Assumptions deep-dive + Learning Center category.
- Multiple optimizer fixture + exact-ledger convergence work.
- Gap-analysis closeout plan executed (SSDI, survivor precision foundations, FICA/SE education view, FRA credit validation, proprietary LICENSE + THIRD-PARTY-NOTICES, spike deletion).
- Enhancements program formalized with scores; many depth plans moved to shipped.

## 2026-05 to early June (v2 Foundations)

**2026-06-11 onward (v2 planner)**
- Added v2 planning docs.
- Core v2 engine: deterministic projection, federal tax + RMDs, healthcare (Medicare/IRMAA/ACA), penalties, QCDs.
- Full Social Security integration (PIA from earnings, survivor, earnings test).
- Roth conversions + withdrawal strategies.
- Monte Carlo engine + worker pool + scenarios/compare.
- Rebuilt planner UI/shell around full household plan model (replaced earlier single-purpose SS/longevity workbench).
- Persistence: IndexedDB + JSON backup/restore.
- Original routes (`/social-security`, `/longevity`) retired in favor of integrated `/plan/*`.

**2026-05-13 (Initial)**
- Project initialized as RetireCalc (React + Vite + TS + Azure SWA CI).
- Life expectancy / longevity calculator (M2).
- Social Security calculator (M3): claiming ages, breakeven, PIA from earnings (M4), PDF export (M5), couple/spousal/survivor (M6).
- mySSA XML import, wizard UX, storage, tests, error boundaries.
- Early roadmap / backlog docs.
- JSON data portability.

## Notes

- The app evolved from a focused Social Security + longevity tool (RetireCalc) into a full privacy-first, browser-only retirement planner with taxes, optimization, Monte Carlo, Learning Center, and deep modeling.
- July 2026 saw a concentrated "depth wave" delivering most of the advanced planning features (allocation, guardrails, objectives, estate/annuity, SS precision, etc.) while keeping additive/no-schema-bump discipline.
- Historical detailed build plans (even shipped ones) live in `DOCS/enhancements/`. Ground-truth descriptions of current behavior live in `DOCS/features/`, `DOCS/domain/`, architecture, etc.
- No formal semantic versions; development is commit- and date-driven with frequent exact-ledger + test guardrails.

For the live app and full source, see the repository and https://retiregolden.app/.
