# The calculation boundary

Swept: 2026-08-24, over `packages/planner-ui/src` and `app/src` in this repository, plus — as a
**dated cross-repo observation** — the RetireGolden-MCP host layer, read from that repository's own
checkout on the same date. MCP statements on this page describe what was observed there and then;
they are not verifiable from this tree and must be re-verified in that repository before being
relied on. Companion to [rule-coverage.md](rule-coverage.md), which covers the engine side. This page records the
one boundary the coverage system cannot express as a per-file attestation: **tax/benefit-law-derived
claims live only in `packages/engine/src`; everything outside composes engine results, presents them,
or ingests data into the plan schema.** The sweep verified that invariant, recorded where it bends,
and assigned each finding a disposition.

## Standing guards

Two mechanical guards keep the boundary from silently eroding; both live in the consumer packages and
run in the normal test job:

- `packages/planner-ui/src/engineRuleReferences.test.ts` and `app/src/engineRuleReferences.test.ts` —
  every backticked registry-rule-shaped token in consumer sources must exist in `taxRuleIds`, and no
  import specifier may reach engine internals: `engine/src/`, `engine/dist/`, `params/data/`,
  `params/state/data/`, or any `@retiregolden/engine/…` path that is not a published package export
  subpath (Vite aliases `@retiregolden/engine/*` onto `packages/engine/src/*`, so alias-reachable
  internals are blocked by resolving specifiers against `packages/engine/package.json` exports).
  RESTATED law — locally recomputed thresholds, rates, or eligibility predicates — is policed by
  sweeps and spot-audits, not by these tests.

The plan that created this page originally called for banning consumer imports of
`@retiregolden/engine/params` outright. That ban would be wrong: twenty-plus modules legitimately
*display* pack values through the public subpath (the provenance panel, the disclaimer, contribution
caps in field copy). Display-read is permitted; the violations worth machinery are deep imports (banned
above) and locally *restated* law (inventoried below, caught by sweep + review rather than by grep).

## Findings and dispositions

### A. Executable law-derived logic outside the engine — migrate or consume engine APIs

| Module | Finding | Disposition |
|---|---|---|
| `planner-ui/src/planner/eligibilityFactActions.ts` | Local age-70½ threshold arithmetic (`month <= 6 ? 70 : 71`) | **Migrate**: the engine's exact-cent action layer already owns 70½ (846-month clamps); export the threshold-year helper and consume it |
| `planner-ui/src/planner/retirementActionEligibilityFacts.ts` | Contribution-history range starts at a locally computed 70½ threshold year | **Migrate** with the row above |
| `planner-ui/src/socialSecurity/explain.ts` | Hardcoded PIA bend rates (0.9/0.32/0.15), $1,810 credit earnings, 40-credit rule | **Source from engine/packs**: constants must come from `ssaWageData`/pack APIs even in educational math |
| `planner-ui/src/socialSecurity/expectedPv.ts` | Local 50% spousal top-up model | **Queued decision**: migrate into engine or carry an explicit educational-not-ledger marker |
| `planner-ui/src/socialSecurity/breakEven.ts` | Local COLA-from-62 accrual model | Same queued decision as `expectedPv.ts` |
| `planner-ui/src/socialSecurity/survivorSwitching.ts` | Local own-claim 62–70 clamps and switching model | Same queued decision; clamps should consume engine claim-window constants |
| `planner-ui/src/socialSecurity/ficaReturn.ts` | Local 6.2%/12.4% statements and self-employed doubling (rate input from pack) | **Source from packs** for the doubling; keep the lens clearly non-ledger |
| `planner-ui/src/report/reportModel.ts` | Local Roth five-year presentation window and §1.408-8(c)(3) treat-as-own routing derived from engine evidence | **Verify-and-mark**: confirm it only re-labels engine-published evidence; any independent decision migrates |
| `planner-ui/src/planner/SsAnalysisPage.tsx` | Survivor-switching panel filtered deceased former spouses | **Closed (partial predicate)**: `passesModeledOrdinaryWidowRecordGates` from `maritalBenefits` applies modeled record gates (relationship, 9-month duration, historical pre-60 remarriage); does not test current marital status, statutory duration/remarriage exceptions, or complete widow entitlement — `isWidowEligible` owns claimant age; claim timing is out of scope for that UI path |
| `planner-ui/src/planner/ssAnalysis.ts` | Benefits-only divorced-spousal floor assumes ex-worker condition from selected claim age without waiting for ex age 62 | **Disclosed residual**: UI callout when a living divorced record is present; future fix needs a year-varying floor keyed to availability year, not a single ex-worker assumption at claim year; ledger path unchanged |
| `planner-ui/src/planner/SocialSecuritySection.tsx` | Executable default `marriageYears: relationship === 'divorced' ? 10 : 1` bakes the SSA 10-year divorced-spouse duration rule into UI state | **Consume engine constant**: `DIVORCED_MIN_MARRIAGE_YEARS` from `@retiregolden/engine/socialSecurity/maritalBenefits` (already exported; `ssAnalysis.ts` imports it) |

### B. Statutory claim-age bounds mirrored as UI input constraints

`ssAnalysis.ts`, `scenarioLevers.ts`, `ScenariosPage.tsx`, `SsAnalysisPage.tsx`,
`SocialSecuritySection.tsx`, `ssFormUtils.ts`, `persistedSsGuard.ts` all restate the 62–70 claim
window (and `survivorAnalysis.ts` names the 12% bracket as a scenario lever's fill target).
**Disposition:** low risk — the engine's `claimFactor` guards own the rule and would reject anything
outside the window; the improvement is exporting the bounds as engine constants so seven mirrors
become one import. The 12% fill target is a product scenario parameter, not a restated rule.

### C. Legal constants in user-facing copy

`PensionAnnuityAccountEditors.tsx` (QLAC $210,000 / age 85), `PropertyDebtAccountEditors.tsx`
(§121 figures), `RetirementAccountEditors.tsx` (RMD, inherited-account, and catch-up copy),
`LiquidAccountEditors.tsx` (taxable-yield copy), `AccountEditorSharedFields.tsx`
(inherited-contribution and estate-tax copy),
`StrategySection.tsx` (QCD 70½, $3,000
capital-loss limit), `AssumptionsSection.tsx` + `import/tenForty.ts` (IRMAA two-year lookback),
`sectionHelpers.ts` (rule-restating comments), `retirementActionQcdSchedule.ts` (post-70½ copy).
**Disposition:** copy-review queue — figures that exist in packs should interpolate from them;
prose that restates a registered rule should cite the record id per the repo convention.

### D. Acceptable by design

- `app/src/cases/owlParity.ts` — local 15% cap-gains rate, 2032 expiration: **external oracle
  assumptions** for the Owl adapter, deliberately not engine law.
- RetireGolden-MCP `src/adapter.ts` — sums `tax + penalties` and subtracts estate summaries for batch
  objectives: **composition arithmetic** over engine outputs; no statutory transform.
- `AllocationPanel.tsx` blended-return estimator, `longevity` health multipliers, spending shape
  presets — **documented product/planning models**, not law.

## What the sweep did not find

No production module outside the engine imports `engine/src`, `engine/dist`, or a parameter data
table directly. No consumer module cites a rule id the registry lacks. The MCP host applies no
statutory rules. The re-implementation risk is concentrated in the planner-ui `socialSecurity/`
educational modules named above — a known, now-inventoried second-model surface, not a diffuse one.
