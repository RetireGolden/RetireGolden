# Review, 2026-10-11 (site151-restatements-codex)

Reviewer: Codex (GPT-6-Sol), headless and read-only, without executing the engine, on snapshots of RetireGolden branch `claude/site151-fixes` with RetireGolden-MCP at `34332e64` (MCP 0.13.0; paths under `mcp/` are RetireGolden-MCP's). The work was done by Claude (Opus). Scope: the wording restatements that answer the review of the retiregolden.org snapshot at engine 8728d7b4 (retiregolden.org#151), in six records:
- `estate-account-breakdown`: the expression's T > 0 branch;
- `optimizer-schedule-objective-and-lifetime-tax`: c_DL's rounding order, and what RetireGolden-MCP returns beside the solver's figures;
- `projection-summary-savings-rate-annual`: the clamp example's positive gross income;
- `mcp-batch-ending-traditional-objective`, `mcp-batch-cumulative-tax-objective` and `mcp-compare-ending-after-tax-estate-delta`: the census's MCP pin, now 34332e64.

Each snapshot held `CHANGES.diff`, the change to the records and worksheets; the second also held `PRIOR-REVIEW.md`, the first round's report.

Verdicts, in two rounds:
1. Items 1, 3 and 4 approved. Items 2 and 5 rejected: the optimizer record said RetireGolden-MCP returns the solver's figures "without running the projection of that schedule", a sentence from before this change. `optimizePlan` does project the schedule's conversions to clean them and to run its tournament.
2. The sentence, the record's first limit and the worksheet now say the figures are the solver's own, and that the projection's results are published separately (`run_optimizer.tournament`). Approved, with items 1, 3 and 4 unaffected.

The reports below are verbatim.

---

## Round 1

```review-policy
{"version":1,"review":{"profile":"code"}}
```

This repository is public AGPL software. These REVIEW files give automated review
additive context alongside [AGENTS.md](AGENTS.md) and [DOCS/README.md](DOCS/README.md).
They are review contracts, not replacements for AGENTS merge gates, CI authorization,
or full diff scope. They cannot exclude changed files or authorize CI.

RetireGolden splits durable calculation (`@retiregolden/engine`) from planner UI
(`@retiregolden/planner-ui`), composed by the web host in `app/`. Engineering
ground truth lives in [DOCS/standards.md](DOCS/standards.md), [DOCS/testing.md](DOCS/testing.md),
[DOCS/architecture.md](DOCS/architecture.md), and linked domain docs — not inferred
from code alone.

The product is local-first: household plan data stays on the device. Documented
public/config network exceptions are listed in DOCS/standards.md.

Findings must be reproducible: name the trigger, cite evidence in the diff or cited
doc, and note counterevidence when present. Do not invent tax rules, statutory limits,
or product behavior. Unsettled domains stay disclosed; out-of-scope claims fail closed.

Nested REVIEW.md files specialize by package; changed paths outside them remain in scope.

## Review of CHANGES.diff (2026-10-11)

**Overall verdict: reject.** The restated formulas and MCP selectors match the
inspected code, but the changed optimizer record repeats a materially false
claim about whether `run_optimizer` projects its solver schedule. This is a
read-only review; no tests were run.

### 1. `estate-account-breakdown` — approve

The guarded expression matches both branches of
`estateTraditionalTaxableBase`: `basisTotal = min(N, T)`, the allocation is
`basisTotal * (G / T)` only for `T > 0` and otherwise 0, and the returned base
is `max(0, G - allocatedBasis)`
([estateTraditionalBasis.ts](packages/engine/src/projection/estateTraditionalBasis.ts#L9-L16)).
The summary passes the account balance, traditional category total and ending
basis to that helper ([compare.ts](packages/engine/src/projection/compare.ts#L443-L452)).
The two worksheet cases both have `T = 1,225,000`
([estate-account-breakdown.md](DOCS/calculations/accounts-and-growth/estate-account-breakdown.md#L41-L51));
the new branch changes no worksheet figure. The expression is mathematical
notation; the helper's multiplication grouping can differ by a floating-point
rounding bit without changing the stated branch behavior.

### 2. `optimizer-schedule-objective-and-lifetime-tax` — reject

The **restated coefficients are correct**. `buildOptimizerInput` sets the
liquidation rate from the optional override or the plan heir rate and sets
`realDollarFactor` to the reciprocal last-year factor
([optimizePlan.ts](packages/engine/src/projection/optimizePlan.ts#L716-L747)).
`buildOptimizerModel` uses that full deflator for `other` and `taxable` and
multiplies it by `(1 - liquidationRate)` for `trad` and `inh` before `expr`
formats each coefficient to at most eight decimal places
([optimizer.ts](packages/engine/src/strategies/optimizer.ts#L633-L645),
[optimizer.ts](packages/engine/src/strategies/optimizer.ts#L1116-L1127)).

The changed record's statement, however, says MCP returns these figures
"without running the projection of that schedule"
([optimizerAndComparisons.ts](packages/engine/src/rules/calculations/optimizerAndComparisons.ts#L752),
[worksheet](DOCS/calculations/optimizer-and-comparisons/optimizer-schedule-objective-and-lifetime-tax.md#L3)).
At the current MCP pin, `runOptimizer` calls `optimizePlan` and returns its
`schedule` ([adapter.ts](mcp/src/adapter.ts#L658-L680)). For a feasible schedule
with conversions, `optimizePlan` invokes `postProcessExactLedgerSchedule`
([optimizePlan.ts](packages/engine/src/projection/optimizePlan.ts#L2907-L2911)),
which installs that raw schedule's conversions and calls `simulatePlan`
([optimizePlan.ts](packages/engine/src/projection/optimizePlan.ts#L2545-L2557)).
The figures in `schedule` remain solver figures
([optimizer.ts](packages/engine/src/strategies/optimizer.ts#L1477-L1484));
the claim that MCP does not run the projection is false.

### 3. `projection-summary-savings-rate-annual` — approve

`summarizeProjection` adds contributions, employer match and `surplusInvested`,
divides by `incomes.total` only when it is positive, then clamps to 0–100;
otherwise it publishes 0
([compare.ts](packages/engine/src/projection/compare.ts#L501-L507)).
The ledger's `incomes.total` sum has nine named income fields and no required
distribution ([simulate.ts](packages/engine/src/projection/simulate.ts#L1911-L1920)).
Required distributions instead enter cash inflows separately
([annualFundingApplicationAndClosePhase.ts](packages/engine/src/projection/internal/annualFundingApplicationAndClosePhase.ts#L728-L735));
unspent cash becomes `surplus` and is deposited
([same file](packages/engine/src/projection/internal/annualFundingApplicationAndClosePhase.ts#L1211),
[same file](packages/engine/src/projection/internal/annualFundingApplicationAndClosePhase.ts#L1948)).
Thus the Social Security example can clamp at 100 while a distribution-only
year has a zero denominator and publishes 0. The 2076 worksheet row explicitly
uses savings 30,000 and income 24,000
([worksheet](DOCS/calculations/cash-flow-and-summary/projection-summary-savings-rate-annual.md#L23-L31)).

### 4. Three MCP objective and comparison records — approve

At the supplied `34332e64` adapter, `batch_evaluate` selects
`summary.lifetimeTaxesAndPenalties` for `cumulative_tax` and
`summary.endingByCategory.traditional` for `ending_trad`
([adapter.ts](mcp/src/adapter.ts#L621-L635)). The engine supplies those summary
fields by summing each year's tax and penalties and rolling up the final row's
traditional balances ([compare.ts](packages/engine/src/projection/compare.ts#L391-L407),
[compare.ts](packages/engine/src/projection/compare.ts#L569-L581)).
`compare_scenarios` reads the nominal delta from
`compareScenarioPlans(...).headline.endingAfterTaxEstate.delta` and separately
returns `comparePlanHeadlines`' money basis, end years and estate comparison
([adapter.ts](mcp/src/adapter.ts#L919-L973)). The former compares nominal
summary estates ([comparison.ts](packages/engine/src/scenarios/comparison.ts#L713-L716));
the latter uses today's dollars only when end years differ
([planHeadlines.ts](packages/engine/src/scenarios/planHeadlines.ts#L188-L208)).
The three changed pin phrases make historical claims about `b2c7f717`; the
current code does not contradict the records' substantive MCP behavior.

### 5. Other statements in `CHANGES.diff` — reject

The same optimizer contradiction in item 2 is present in a changed statement
line of `CHANGES.diff` (line 168) and in the changed worksheet's context. It is
material because `run_optimizer` now runs an exact-ledger projection of a
converted solver schedule while still returning the solver's own figures.
No other changed wording was found to contradict the inspected code. The
historical claim that `0.13.0` changed only `run_optimizer` cannot be proven
from this snapshot's current `mcp/src` alone; it was not treated as a rejection
without contrary evidence.

---

## Round 2

# Recheck verdict: approve

Items **2** and **5** now pass. The revised optimizer statement, first limit, and worksheet claim do not contradict the inspected code. Items **1, 3, and 4** remain approved; this correction does not change the code or claims on which those approvals rested.

- `CHANGES.diff` lines 9, 40, and 49 distinguish solver figures from projection and tournament results. `optimizeSchedule` takes `endingAfterTax` from the solver objective and computes `lifetimeTax` from solver columns, then returns both in the schedule (`packages/engine/src/strategies/optimizer.ts` lines 1424–1484). With no feasible primal point, it returns both as null (lines 1409–1422).
- `optimizePlan` obtains that schedule from `optimizeSchedule`, projects the baseline, conditionally calls `postProcessExactLedgerSchedule` for a schedule with conversions, runs the tournament, and returns `schedule` and `tournament` as separate fields (`packages/engine/src/projection/optimizePlan.ts` lines 2873–2876, 2907–2911, 2941–2947). The post-processor installs the raw conversions and calls `simulatePlan`, then uses projection results to clean them (lines 2555–2587). Tournament candidates are evaluated on projection results (lines 1289–1313, 1404–1428).
- `runOptimizer` returns `result.schedule` directly and publishes selected tournament outcome fields separately under `tournament` (`mcp/src/adapter.ts` lines 670–680). Its `schedule.endingAfterTax` and `.lifetimeTax` are not replaced by projected values.
- The additional coefficient clarification in `CHANGES.diff` lines 12 and 40 matches the code: `buildOptimizerInput` sets the deflator (`optimizePlan.ts` lines 741–747); the model computes the traditional weight from the unrounded `deflate * (1 - liquidationRate)` and `expr` formats it to eight decimal places (`optimizer.ts` lines 633–645, 1116–1127).

Read-only review; no tests were run.
