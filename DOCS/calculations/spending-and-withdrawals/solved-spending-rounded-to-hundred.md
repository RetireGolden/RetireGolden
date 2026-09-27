## Claim

Kind: formula. `engine/src/decisions/spendingSolver.ts#roundSolvedSpending(amount)` (new) is the $100 floor the planner applies to the solver's answer: `floor(amount / 100) × 100`. The solver itself publishes that floor as its answer: `SustainableSpendingResult.maxBaseAnnual` becomes the rounded amount, the exact bisection probe moves to a new field `feasibleBaseAnnual`, and `spendingSlackDollars` becomes `maxBaseAnnual − currentBaseAnnual` (owner decision R4: one slack everywhere, computed from the amount the page shows). Every surface then shows, applies and measures slack from one number.

## What the UI computes today

Pins: RetireGolden `origin/main` `a7f62f1e`; slice 1 (#747, branch `claude/b2p1-slice1-ledger-figures`, read at `4109e0b4`; the page is unchanged at its current head `093ae4b6`) moves the lines given in brackets.

`planner-ui/src/planner/SpendingSolverPage.tsx`:

```tsx
const solvedRounded = result?.maxBaseAnnual != null ? Math.floor(result.maxBaseAnnual / 100) * 100 : null   // :173 [#747 :198]
...
d.expenses.baseAnnual = solved                                  // :179, Apply writes the plan
const baseName = `Spend ${fmtMoney(solved)}/yr (max sustainable)` // :188, Add as scenario (patch baseAnnual: solved, :194)
const slack = result && solvedRounded !== null ? solvedRounded - result.currentBaseAnnual : null           // :200 [#747 :225]
```

`solvedRounded` is printed at :285 (hero), :301 (tile), :331, :365, :380 (copy) and :510-511 (the SWR table's solved row, see `solved-initial-withdrawal-rate-pct`); the slack at :288-290 and :307. The same floor is written a second time per spending shape at :437 (see `spending-shape-delta-vs-flat`). Inputs: `SpendingSolveResult.maxBaseAnnual` and `.currentBaseAnnual` (`optimize/runSpendingSolve.ts:22-24`, which copies `solveMaxSustainableSpending`'s result and `req.plan.expenses.baseAnnual`).

Every other surface reads the engine's unrounded figures (R4):

| Surface | Reads | Where |
|---|---|---|
| Insights, spending-headroom card after Preview | `maxBaseAnnual` in the text, the scenario name and the patch it previews (`baseAnnual: maxBaseAnnual`); `spendingSlackDollars` in the text and in the gate `slack < 1,000` | `engine/src/insights/detectors/spendingHeadroom.ts:115-130` |
| Scenarios page, "Sustainable spending capacity" | `maxBaseAnnual` and `spendingSlack` for baseline, proposal and delta | `engine/src/scenarios/comparison.ts:339-340`, `planner-ui/src/planner/ScenariosPage.tsx:613-614` |
| Tax-strategy tradeoff metrics | the same comparison, as "higher is better" metrics | `engine/src/scenarios/taxStrategyTradeoffs.ts:264-265, 769-770, 848-849, 1183-1190` |
| RetireGolden-Pro (`ed08803`) | capacity `maxBaseAnnual` and `spendingSlack` | `src/renderer/src/cockpit/TaxCockpitScreen.tsx:827-833`, `meeting/MeetingViewScreen.tsx:159, 381, 385, 1248, 1257, 1270`, `meeting/meetingViewModel.ts:195`, `memo/MemoScreen.tsx:697-703` |
| RetireGolden-MCP (`3197d35`) | `solve_max_spending.maxBaseAnnual`, `.spendingSlackDollars` | `src/adapter.ts:496-497` |

So today the solver page applies and shows 62,800 while the insight card shows and previews 62,813 for the same solve, and the page's slack differs from everyone else's by `maxBaseAnnual mod 100`.

## Engine publication

```ts
// engine/src/decisions/spendingSolver.ts
/** The step the published answer is floored to: the solver resolves ~$500, so dollars below $100 claim precision it lacks. */
export const SOLVED_SPENDING_STEP_DOLLARS = 100
/** floor(amount / 100) × 100; RangeError unless amount is finite and >= 0. */
export function roundSolvedSpending(amount: number): number

export interface SustainableSpendingResult {
  /** CHANGED: roundSolvedSpending(feasibleBaseAnnual), today's dollars. The amount every surface shows, applies and measures slack from. Null when nothing is feasible. */
  maxBaseAnnual: number | null
  /** NEW: the highest probe that passed (a whole dollar); bestEvaluation is the exact-ledger run at this level. */
  feasibleBaseAnnual: number | null
  /** CHANGED: maxBaseAnnual − currentBaseAnnual (the basePatch's base spending when present, else the plan's). */
  spendingSlackDollars: number | null
  /** NEW, see solved-initial-withdrawal-rate-pct. */
  initialWithdrawalRatePct: number | null
  // bestEvaluation, converged, limitingConstraint, simulationCount, diagnostics unchanged
}
```

In `finish()`: `feasibleBaseAnnual = bestFeasible?.amount ?? null`; `maxBaseAnnual = feasibleBaseAnnual === null ? null : roundSolvedSpending(feasibleBaseAnnual)`; `spendingSlackDollars = maxBaseAnnual === null ? null : maxBaseAnnual - currentBaseAnnual`. The probe sequence, the budget, `converged` and `limitingConstraint` do not change.

- Domain: every probe is a whole number of dollars in `[0, 2^53)`: the seed is `max(0, round(current))`, the doubling probes are `max(2 × seed, 20,000) × 2^j`, and each midpoint is `round((lo + hi) / 2)` (`spendingSolver.ts:197, 209, 219, 250`). For a whole `x` below about `7 × 10^13`, `x / 100` is either an exact integer or at least 0.01 from one, far beyond its rounding error, so `floor(x / 100) × 100` is exactly `x − (x mod 100)`. The author's script checked every integer from 0 to 2,000,000 and four near `2^40` to `2^53`: 0 mismatches.
- Units: today's dollars per year. Timing: once per solve. Rounding: down to $100, in the engine; `fmtMoney` then prints whole dollars.
- `feasibleBaseAnnual` is kept, not deleted: it is the level the evidence ("From the full projection run at the solver's exact answer (shown as $X/yr, rounded down to the nearest $100)", page :330-331) was computed at.
- Consumers after the move: the solver page reads `maxBaseAnnual` and `spendingSlackDollars` from the worker (the worker passes them through; `solvedRounded` and `slack` are deleted); the insight card, the Scenarios page, the tradeoff metrics, Pro and the MCP read the same fields and so move to the rounded amount without code changes of their own.

### Carried from slice 1 (its open question 5): today's-dollar evidence on the solver page

Slice 1 left the page converting two nominal figures with `planDollarBasis(inflationPct, solveStartYear, endYear)` (`todayDollarsOf`, #747 `SpendingSolverPage.tsx:34-38`) "until slices 2 and 3 publish today's-dollar fields on those rows from each run's own factor". Slice 2 does it for this page:

- `engine/src/decisions/swrComparator.ts#SwrRuleResult.endingAfterTaxEstateTodayDollars` (new): `toTodayDollars(projectionDollarBasis(result), result.endYear, summary.endingAfterTaxEstate)` from each rule's own run.
- `planner-ui/src/optimize/runSpendingSolve.ts`: the evidence gains `endingAfterTaxEstateTodayDollars = toTodayDollars(projectionDollarBasis(best.candidateResult), best.candidateResult.endYear, summary.endingAfterTaxEstate)` (a composition of two engine functions on the run's own rows).
- The page deletes `todayDollarsOf` and its `planDollarBasis` import. Nothing displayed changes: on all 29 examples the deterministic run's `inflationScale` equals `planDollarBasis(plan.assumptions.inflationPct, 2026, endYear)` bit for bit in every year (scratch run, `factorBitDiff = 0` for every example); a solver or SWR run has no `market` series, so its factor is the plan rate's.

## Justification

A product rule, not a law: the solver bisects to about $500 (`DEFAULT_RESOLUTION_DOLLARS`, `spendingSolver.ts:74`), and the page's own help text (`:303`) promises the shown figure is "rounded down to the nearest $100. The same rounded figure is what Apply and scenarios use." Flooring (not rounding to nearest) keeps the published amount at or below a level that passed. R4 (decided 2026-09-25) requires one slack computed from the amount shown; publishing the floor as the solver's answer is the only way every consumer, including Pro and the MCP, shows the same amount beside the same slack.

## Inputs

| Case | `feasibleBaseAnnual` (the passing probe) | `currentBaseAnnual` |
|---|---:|---:|
| A (bisection evidence) | produced by the solver, feasibility `amount ≤ 62,850`, seed 40,000, budget 25, resolution 500 | 40,000 |
| A′ | same, current 40,000.40 | 40,000.40 |
| B | 62,800 | 60,000 |
| C | 45,099 | 48,500.50 |
| D | 0 | 12,000 |
| E | 99 | 0 |
| F | none feasible | 30,000 |
| G | 61,080 | 60,050 |

## Arithmetic

A. The probe sequence, re-derived from the contract (author's `scripts/solver-independent.mjs`, no engine import): seed 40,000 passes; doubling probe `max(80,000, 20,000) = 80,000` fails; bisection `60,000` pass, `70,000` fail, `65,000` fail, `62,500` pass, `63,750` fail, `63,125` fail; the bracket 62,500..63,125 is 625 wide (> 500), so `round(62,812.5) = 62,813` (JavaScript rounds the half up) passes; the bracket 62,813..63,125 is 312 wide, stop. Nine simulations, converged. `feasibleBaseAnnual = 62,813`; `maxBaseAnnual = floor(628.13) × 100 = 62,800`; slack `62,800 − 40,000 = 22,800`. Today the engine publishes 62,813 and 22,813.

A′. Same probes (the seed is `round(40,000.4) = 40,000`). Slack `62,800 − 40,000.4 = 22,799.6`; today 22,812.6.

B. 62,800 → 62,800; slack 2,800 (unchanged, already a multiple of $100).

C. 45,099 → 45,000; slack `45,000 − 48,500.5 = −3,500.5` (today −3,401.5 from the engine; the solver page already shows −3,500.5).

D. 0 → 0; slack −12,000. E. 99 → 0; slack 0 (today 99). F. null, null, null.

G. 61,080 → 61,000; slack 950 (today 1,030). The insight card's evaluate gate (`slack < MIN_SOLVED_SLACK_PER_YEAR = 1,000`, `spendingHeadroom.ts:41, 117`) passed with 1,030 and fails with 950: the card that said "about $61,080/yr ... $1,030/yr above your current level" is no longer offered, consistently with the page, which already showed $950 of slack.

## Expected

| Case | `maxBaseAnnual` | `feasibleBaseAnnual` | `spendingSlackDollars` | `simulationCount` | Tolerance |
|---|---:|---:|---:|---:|---|
| A | 62,800 | 62,813 | 22,800 | 9 | exact |
| A′ | 62,800 | 62,813 | 22,799.6 | 9 | absolute 1e-9 on the slack |
| B | 62,800 | 62,800 | 2,800 | — | exact (`roundSolvedSpending` and the slack expression) |
| C | 45,000 | 45,099 | −3,500.5 | — | exact |
| D | 0 | 0 | −12,000 | — | exact |
| E | 0 | 99 | 0 | — | exact |
| F | null | null | null | — | — |
| G | 61,000 | 61,080 | 950 | — | exact; the insight gate is false |

`roundSolvedSpending(−1)`, `roundSolvedSpending(NaN)` and `roundSolvedSpending(Infinity)` throw a `RangeError`.

Cross-check (engine run in the scratch copy, after the values above were derived): the current solver with the same evaluation double returns probes `[40000, 80000, 60000, 70000, 65000, 62500, 63750, 63125, 62813]`, `maxBaseAnnual` 62,813, slack 22,813 (and 22,812.6 for A′), 9 simulations, converged; the floor of that is the expected 62,800.

## Wrong readings

- Rounding to the nearest $100: 62,850 would publish 62,900, a level above the passing probe that was never shown feasible.
- Flooring to the solver's $500 resolution: 62,500 in case A.
- Slack from the exact probe (today's engine): 22,813 beside a shown 62,800, the R4 defect.
- Rounding the slack instead of the amount: `floor(22,813 / 100) × 100 = 22,800` agrees in case A but not in C (`floor(−3,401.5 / 100) × 100 = −3,500`, not −3,500.5).
- Publishing only a new `roundedMaxBaseAnnual` and leaving `maxBaseAnnual` exact: Pro and the MCP would then print the exact amount beside the rounded slack.

## Displayed change on the example library

Engine run in the scratch copy (start year 2026, the page's budget of 25). Only 7 of the 29 examples produce a solver answer: in the other 22 every probe returns a diagnostic evaluation because the baseline has ACA years whose exact-ledger evidence is non-actionable (`decisions/evaluateCandidate.ts:792-802`), so the page shows "No sustainable spending level found" with that diagnostic (found in passing, not a slice-2 change). For the 7:

| Example | current | exact probe | published (new) | slack today (engine) | slack new | Change on insight card, Scenarios page, Pro, MCP |
|---|---:|---:|---:|---:|---:|---:|
| under-saved-single | 72,000 | 65,250 | 65,200 | −6,750 | −6,800 | −50 |
| bracket-fill-roth | 90,000 | 101,602 | 101,600 | 11,602 | 11,600 | −2 |
| rmd-irmaa | 110,000 | 131,485 | 131,400 | 21,485 | 21,400 | −85 |
| inherited-ira-beneficiary | 72,000 | 26,438 | 26,400 | −45,562 | −45,600 | −38 |
| survivor-years | 72,000 | 59,063 | 59,000 | −12,937 | −13,000 | −63 |
| annuity-purchases-estate | 78,000 | 114,259 | 114,200 | 36,259 | 36,200 | −59 |
| no-annuity-brokerage | 78,000 | 116,391 | 116,300 | 38,391 | 38,300 | −91 |

The solver page's own figures do not change on any example. No insight gate flips on the examples (every slack of 1,000 or more stays at or above 1,000). Every exact probe is a whole number, and on all 7 the rounded amount re-simulated at the page's start year is itself feasible (no depletion, estate at or above the floor).

## Parity test for the switch-over

- `planner-ui/src/optimize/runSpendingSolve.parity.test.ts`: on all 29 examples, `result.maxBaseAnnual === (result.feasibleBaseAnnual === null ? null : Math.floor(result.feasibleBaseAnnual / 100) * 100)` and `result.spendingSlackDollars === result.maxBaseAnnual - plan.expenses.baseAnnual` (Object.is), i.e. the retired page expressions; null on the 22 diagnostic examples.
- `planner-ui/src/planner/SpendingSolverPage.parity.test.tsx` (jsdom, the worker's synchronous fallback): for `rmd-irmaa` the hero reads "about $131,400", the tiles "$131,400/yr" and "+$21,400/yr", Apply writes `baseAnnual` 131,400, and "Add as scenario" creates "Spend $131,400/yr (max sustainable)" with that patch; the evidence estate in today's dollars equals the retired `planDollarBasis` conversion bit for bit.
- Insight card (`planner-ui/src/planner/insights/spendingHeadroom.parity.test.ts`, or an engine test): on each answering example whose card the detector's screen offers (no depletion and enough excess estate; the implementer lists which), the evaluated card's text names the solver's `maxBaseAnnual` and `spendingSlackDollars` and its preview patch is `baseAnnual: maxBaseAnnual`, the same amount the solver page's Apply writes; for `rmd-irmaa`, if offered, that is $131,400 and $21,400.
- `ScenariosPage` capacity table: baseline "Solved annual base spending" equals the solver's `maxBaseAnnual`.
- Acceptance grep in `SpendingSolverPage.tsx`: no `Math.floor(`, no `- result.currentBaseAnnual`.

## Proposed calculation record

- New: id `solved-spending-rounding`, group `spending-and-withdrawals`, kind `formula`, outputs `['solved-spending-rounded-to-hundred', 'sustainable-spending-result-max-base-annual']` (after the change both families publish the floor; the bisection record keeps the second too, for the probe it is taken from), feeds `['sustainable-spending-result-spending-slack-dollars', 'solved-initial-withdrawal-rate-pct', 'spending-shape-delta-vs-flat']`. Statement: "decisions/spendingSolver.ts#roundSolvedSpending floors a nonnegative amount to a whole multiple of SOLVED_SPENDING_STEP_DOLLARS (100): floor(x / 100) × 100. The solver publishes it as maxBaseAnnual and measures spendingSlackDollars from it. Units: today's dollars per year. Rounding: down to $100." Formula `r = floor(x / 100) · 100`. Justification: derivation, `DOCS/calculations/spending-and-withdrawals/solved-spending-rounded-to-hundred.md`. Limits: "The published amount is not re-simulated: it is feasible because the probe above it passed and feasibility is assumed monotone in base spending (true on the 7 answering examples); the evidence figures describe the passing probe, feasibleBaseAnnual." implementedByFunctions `packages/engine/src/decisions/spendingSolver.ts#roundSolvedSpending`.
- Restate `sustainable-spending-bisection` (`rules/calculations/cashFlowAndSummary.ts:245-276` at `a7f62f1e`): statement and formula add "maxBaseAnnual = floor(best feasible probe / 100) × 100; spendingSlackDollars = maxBaseAnnual − current base; feasibleBaseAnnual publishes the probe"; its existing evidence (result 62,500, slack 22,500) is unchanged because 62,500 is a multiple of $100, so add case A above as a second block, which fails against today's solver (62,813, 22,813).
- Restate the doc comments on `SustainableSpendingResult` and on `SpendingSolveResult` (`planner-ui/src/optimize/spendingMessages.ts:27-30`).
- `SwrRuleResult.endingAfterTaxEstateTodayDollars` joins the record `display-dollar-basis-conversion` (slice 1) as an implementing call site; no new record.

## Census bookkeeping

Convention (RetireGolden #747 at `093ae4b6`, Docs `3b5f835`): a relocated family's `uiSources` name the UI symbols that now read the engine value, the retired computing symbol moves to `notes` as history, and a conformance test fails on a `uiSources` entry that names a missing file or symbol.

- `solved-spending-rounded-to-hundred`: `relocation: { status: 'done', target: 'engine/src/decisions/spendingSolver.ts#roundSolvedSpending' }`; `uiSources` `[SpendingSolverPage.tsx#SpendingSolverPage, ScenariosPage.tsx#CapacitySection]` (the readers); notes "Computed in planner-ui/src/planner/SpendingSolverPage.tsx#SpendingSolverPage (Math.floor(maxBaseAnnual / 100) × 100) until B2-P1 slice 2; now engine engine/src/decisions/spendingSolver.ts#roundSolvedSpending, published as SustainableSpendingResult.maxBaseAnnual, which SpendingSolverPage and CapacitySection read."; meaning becomes "Maximum sustainable baseline spending rounded down to the nearest $100: the amount the solver publishes and every surface shows, applies and measures slack from."; transformations "floor(feasibleBaseAnnual / 100) × 100 in decisions/spendingSolver.ts#roundSolvedSpending (R4)."; surfaces add `insights` (spending-headroom card after Preview), `scenarios-page` (Solved annual base spending) and `mcp` (`solve_max_spending.maxBaseAnnual`).
- `sustainable-spending-result-max-base-annual`: meaning "Highest annual base spending the solver found feasible, rounded down to the nearest $100 (today's dollars)." The census `basis` is `nominal` for it and for the slack family; both are today's dollars (the solver's doc and `ComparisonMoneyBasis.spendingCapacity: 'today'`): correct to `real`.
- `sustainable-spending-result-spending-slack-dollars`: meaning "Solved spending (rounded down to $100) minus current base spending; negative means today's spending is above what the plan sustains." The page's recomputation (R4, `SpendingSolverPage.tsx:200`), which the census never listed, is retired by this slice, so nothing is added to `uiSources`.
- `display-dollar-basis-conversion` (slice 1): its `uiSources` entry `planner-ui/src/planner/SpendingSolverPage.tsx#todayDollarsOf` must become `SpendingSolverPage.tsx#SpendingSolverPage` plus `planner-ui/src/optimize/runSpendingSolve.ts#runSpendingSolveRequest` in the same change that deletes `todayDollarsOf`, or #747's uiSources conformance test fails; its transformations' "a page with no projection rows uses planDollarBasis" then applies to the relocation page only.
- Field coverage: new rows `SustainableSpendingResult.feasibleBaseAnnual` (`unsurfaced-evidence`: the passing probe the evidence ran at; no surface prints it), `SwrRuleResult.endingAfterTaxEstateTodayDollars` (family `display-dollar-basis-conversion`), `SpendingSolveEvidence.endingAfterTaxEstateTodayDollars` (same family); the planner-ui row `SpendingSolverPage.solvedRounded` is deleted with the variable.
- CHANGELOG (engine): `maxBaseAnnual` now publishes the $100 floor and `spendingSlackDollars` is measured from it; the exact probe is `feasibleBaseAnnual`.

## Family

outputs: `solved-spending-rounded-to-hundred`, `sustainable-spending-result-max-base-annual`.

feeds: `sustainable-spending-result-spending-slack-dollars`, `solved-initial-withdrawal-rate-pct`, `spending-shape-delta-vs-flat`.

## Provenance

Derived by: claude (opus 5.5), 2026-09-26, from the source at `a7f62f1e` and #747 `4109e0b4`; expected values from hand arithmetic and the author's `scripts/independent.mjs` and `scripts/solver-independent.mjs` (no engine import); engine cross-checks (`scripts/engine-solver.json`, `scripts/engine-solver-rounding.json`) run afterwards in the scratch copy. Checked by: a separate Claude (Opus 5.5) instance that did not derive it, which recomputed every value with its own scripts and ran the engine where a claim was numeric (RetireGolden-Docs `calculations/bidirectional-validation-plan-2026-09-13/evidence/b2p1-slice2-check.md`): every expected value reproduces; its corrections are applied in the implementation section. Reviewed by: pending; the catalog asks for a reviewer of a different agent family, so the record is `unreviewed`.

## Implementation (B2-P1 slice 2, 2026-09-27)

Implemented by a claude subagent on RetireGolden `a70eb815` (the first commit of #750, on `main` `37d9ae3e`), after #748 changed the solver this worksheet was derived on. What differs from the derivation above, and why:

- **R4 under guardrail spending (decided 2026-09-27).** The derivation proposed publishing the floor with no extra run, stating monotone feasibility as a limit (its open question 2). #748's check proved feasibility is not monotone under guardrails, so the decision refined R4: under fixed-target spending the floor is published without a run of its own, on the decision's assumption that a lower base does not fail where a higher one passed; under withdrawal-rate or risk-based guardrails it is published only on a run at it that passed (the search's own probe at that level when it made one, else one more run after the search, outside `maxSimulations` and counted in `simulationCount`); otherwise `feasibleBaseAnnual` itself is published. The fixed-target assumption is measured, not proven: the independent review of the implementation re-simulated all 109 published amounts of the example plans and their shape solves (all feasible), 210 fixed-target balance variants (0.70 to 1.30 times) of ten Marketplace-heavy or early-retirement examples (all feasible), and every $10 level in the $3,000 below the answer on six Marketplace examples (none failed). The mechanism it does not exclude is a lower spend dropping the household's income below 100 percent of the poverty line, where the premium tax credit is lost and the ledger budgets the full premium. `SustainableSpendingResult.maxBaseAnnualRounding` (`'down-to-hundred' | 'none' | null`) says which, and a diagnostic beginning `EXACT_ANSWER_DIAGNOSTIC_LEAD` says why.
- **A floor below the required spending is never published** (found while implementing). Whenever the answer and the required floor sit in the same hundred with the floor above that hundred (`floor100(F) < requiredAnnual <= F`), the rounded amount is below the level the plan checks accept; the exact amount is published with rounding `'none'` and a diagnostic, under any policy, with no extra run. The answer need not be the floor probe itself: rmd-irmaa with `requiredAnnual` 131,450 publishes its seed answer 131,450 exactly (found by the independent review).
- **Correction 1** (a negative slack under $100 is not "cannot sustain"): the solver publishes `sustainsCurrentBase`, the verdict of its first probe (today's base rounded to a whole dollar, or the required floor rounded up when higher), which is the same as `feasibleBaseAnnual >= round(currentBaseAnnual)`; the page reads it, and the scenario capacity comparison carries it per side (`baselineSustainsCurrentBase`, `proposalSustainsCurrentBase`) with each side's `feasibleBaseAnnual` and rounding, so no reader has to infer it from the slack's sign (added after the independent review). The record states the limit.
- **Evidence and disclosure when the rounded amount is published:** `bestEvaluation`, the evidence card and the unpriced premium-credit years describe the run at `feasibleBaseAnnual`, not the published amount; the record says so.
- **Correction 2:** `bestEvaluation`'s doc comment names `feasibleBaseAnnual`.
- **Corrections 3 and 4:** the consumer list is the check's; planner-ui's `SpendingSolveResult` gains `feasibleBaseAnnual`, `maxBaseAnnualRounding` and `initialWithdrawalRatePct` as optional fields, so the Pro app's typed fixtures still compile.
- **Surfaces:** the census family keeps the solver page and adds `ScenariosPage.tsx#CapacitySection` as a reader; the insight card, Scenarios and MCP surfaces are listed on the engine family `sustainable-spending-result-max-base-annual`, which now publishes the same number, so they are not repeated here.
- **`SwrRuleResult.endingAfterTaxEstateTodayDollars`** is `number | null`, null when the rule's run has no years (a horizon that ends before its start), where there is no factor to divide by.

Further evidence cases, derived from the solver's stated contract (the same evaluation double as case A):

| Case | Policy | Levels that pass | Expected |
|---|---|---|---|
| H | withdrawal-rate guardrails | up to 62,850 | the nine probes of case A, then a tenth run at 62,800, which passes: `maxBaseAnnual` 62,800, `feasibleBaseAnnual` 62,813, `simulationCount` 10 |
| I | withdrawal-rate guardrails | up to 62,850, except 62,800 (a lower level failing where a higher one passed) | the tenth run at 62,800 fails: `maxBaseAnnual` 62,813, `maxBaseAnnualRounding` `'none'`, slack 22,813, `simulationCount` 10, one exact-answer diagnostic |
| J | fixed target, `requiredAnnual` 40,050, current 40,060 | up to 40,060 | seed 40,060 passes, 80,120 fails, every midpoint (60,090, 50,075, 45,068, 42,564, 41,312, 40,686, 40,373) fails; 40,060 floored is 40,000 < 40,050, so `maxBaseAnnual` 40,060, rounding `'none'`, slack 0; no probe below 40,050 |
| K | fixed target and withdrawal-rate guardrails, `requiredAnnual` 40,000, current 41,000, resolution $50 | up to 40,060 | seed 41,000 fails; the floor 40,000 passes; midpoints 40,500, 40,250, 40,125, 40,063 fail and 40,032 passes; 40,032 floored is exactly the floor 40,000, which the floor probe already ran and passed: `maxBaseAnnual` 40,000, rounding `'down-to-hundred'`, seven runs under either policy (no extra run) |
| L | fixed target, current 72,030 | up to 72,030 | the seed 72,030 passes and is the answer: `maxBaseAnnual` 72,000, slack −30, `sustainsCurrentBase` true |

A basePatch that replaces the accounts with one $1,000,000 cash account makes the rate `(62,800 / 1,000,000) × 100` = 6.28, not the rate over the unpatched plan's balances.

Real-ledger case (found by the independent review, planner-ui `examples.spendingSolver.golden.test.ts`): the lean-fat-fire example under withdrawal-rate guardrails (upper 150) with a $40,500 required floor passes at $76,641 and runs out of money in 2085 at $76,600, so the solver publishes $76,641 with rounding `'none'`. On `main` before this change the page showed $76,600 there, a figure that depletes.

Re-measured on the example library at `a70eb815` (the derivation's table had 7 answering examples; #748 made 27 answer): the published amount equals the figure the page already showed on all 27, so the solver page changes nothing; the engine's `maxBaseAnnual` and slack drop by `feasibleBaseAnnual mod 100` ($0 to $91) on 25 of them (example-couple 117,000 and no-head-start-grad 55,000 are already whole hundreds), which the insight card (19 cards offered, 17 of them change, no gate flips), the Scenarios capacity table, the tax-strategy tradeoffs, Pro and the MCP now show. No answering example spends under guardrails, so no extra run happens and every probe count is unchanged. Before and after values: RetireGolden-Docs staging `b2p1-s2/addendum.md`.
