# Review, 2026-10-10 (optimizer-solver-output-recheck-codex)

Reviewer: Codex (GPT-6-Sol), headless and read-only, without executing the engine, on a snapshot of RetireGolden branch `claude/optimizer-solver-output` (RetireGolden#793) after its first automated review was answered, and RetireGolden-MCP at `b2c7f717`. The work was done by Claude (Opus). Scope: the sentences that answer changed in `optimizer-schedule-objective-and-lifetime-tax` and its worksheet (the node limit's basis, the slow-machine case of the time limit, the weights' years, the last-row agreement's bound), and the two code changes (`scheduleStatus` reading `Optimal` without a feasible point by its primal status, and `parseRawSolution` reading an `inf` objective as infinity), after Codex had approved the restatement (`REVIEW-2026-10-10-optimizer-solver-output-codex.md`). The snapshot held `ROUND1.diff`, that change, and `PRIOR-REVIEW.md`, the earlier report. `optimizer-schedule-year-solution` did not change. Verdict: approve, 5 of 5 items. Verbatim output follows.

---

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

## Read-only recheck of ROUND1.diff (2026-10-10)

Overall verdict: **approve**. This recheck covers the changed sentences in the two optimizer schedule records and the two optimizer code edits. No tests or solver runs were performed. `node_modules/highs/build` is absent from this snapshot, so the installed binary was not inspected.

### 1. Node limit — approve

The engine pins `highs` 1.15.2 and passes `mip_max_nodes` with a 5,000 default. Its call supplies no thread setting; the pinned package documents its WebAssembly build as single threaded. The record describes cross-machine agreement as an **expectation**, identifies the repeated same-machine measurements, and expressly says cross-machine behavior was not measured. That is a qualified inference from a fixed, single-threaded build and specified floating-point operations, not a claim of a cross-machine measurement or a guaranteed outcome. It applies to a solve that actually reaches the node limit before the separate time guard. Evidence: `packages/engine/package.json:240`; `packages/engine/src/strategies/optimizer.ts:507-521,1354-1357,1392-1405`; `DOCS/calculations/optimizer-and-comparisons/optimizer-schedule-objective-and-lifetime-tax.md:82`; [highs-js package documentation](https://github.com/lovasoa/highs-js/blob/main/README.md).

### 2. Time limit — approve

`optimizeSchedule` passes both `time_limit: input.options?.timeLimitSec ?? 60` and `mip_max_nodes: input.options?.maxNodes ?? 5000` to the same solve. A `Time limit reached` model status maps to `timeout`; with a feasible primal it publishes that incumbent's figures, and without one it publishes null figures. Thus the default 60-second guard can precede the node cap on a slower machine. The resulting incumbent is a time-limited observation, as the record says. Evidence: `packages/engine/src/strategies/optimizer.ts:1354-1357,1365-1384,1392-1426,1478-1486`; `DOCS/calculations/optimizer-and-comparisons/optimizer-schedule-objective-and-lifetime-tax.md:82`.

### 3. Weights and 23 years — approve

`buildOptimizerInput` uses the factor for the last year of the 24-year plan, indexed at 23, and `planDollarBasis` starts at 1 then compounds once for each intervening year. The model writes the deflator and the deflator times `1 - liquidationRate` to eight decimal places. The evidence fixes those weights at 0.56669724 and 0.42502293 for `bracket-fill-roth`, with the 0.25 heir rate. Evidence: `packages/engine/src/projection/optimizePlan.ts:716-748`; `packages/engine/src/projection/dollarBasis.ts:87-102`; `packages/engine/src/strategies/optimizer.ts:633-645,1116-1126`; `packages/engine/src/strategies/optimizer.schedule.evidence.test.ts:325-348,410-420`; `packages/engine/src/rules/calculations/optimizerAndComparisons.ts:781`.

### 4. Last-row agreement — approve

The evidence's maximum cent-rounding allowance is `0.56669724 × 0.01 + 0.42502293 × 0.01 + 24 × 0.000001 × 0.005 + 0.005 = $0.0149173217`, below $0.015. The first two terms cover rounding of the two full-weight and two haircut-weight ending buckets; the third covers 24 rounded conversion entries; the last covers rounding `endingAfterTax` itself. The assertion checks the absolute difference against this allowance. Evidence: `packages/engine/src/strategies/optimizer.schedule.evidence.test.ts:346-347,410-434`; `packages/engine/src/strategies/optimizer.ts:1462-1480,1489-1491`; `DOCS/calculations/optimizer-and-comparisons/optimizer-schedule-objective-and-lifetime-tax.md:76`.

### 5. `scheduleStatus` and `inf` objective — approve

`Optimal` now maps to `optimal` only with `primalStatus === 'Feasible'`; otherwise the primal-status fallback gives `infeasible`. `parseRawSolution` returns immediately for `None`, without reading an objective; for a primal point it parses `inf` as infinity, and `optimizeSchedule` throws if a feasible point has a non-finite objective. This preserves both records' rule that no primal means no published figures or rows, and that a published objective describes a feasible point. The fallback status is a publication label, not independent proof that an unusual `Optimal`/no-primal signal is mathematically infeasible. Evidence: `packages/engine/src/strategies/optimizer.ts:1223-1253,1365-1384,1408-1426`; `DOCS/calculations/optimizer-and-comparisons/optimizer-schedule-objective-and-lifetime-tax.md:3,12,47`; `DOCS/calculations/optimizer-and-comparisons/optimizer-schedule-year-solution.md:11,81`.

---

## Round 2

After RetireGolden#793's second automated review, on a snapshot holding ROUND2.diff: the convergence loop stops at a re-solve that publishes no figures (projection/optimizePlan.ts#convergeSchedule), dated notes in the worksheets of optimizer-schedule-conversion-total and claim-age-co-optimization-estate-gain, and one grammar fix in optimizer-schedule-objective-and-lifetime-tax. Verdict: approve, 3 of 3 items. Verbatim output follows.

# Review of `ROUND2.diff`

## 1. Convergence after a re-solve with no figures — approve

`optimizeSchedule` sets `endingAfterTax` to null and publishes empty rows and conversions whenever the primal point is not feasible, regardless of whether the model status is `infeasible`, `node-limit`, or `timeout` (`packages/engine/src/strategies/optimizer.ts:1365-1383, 1408-1423`). A feasible point instead produces a finite figure and rows (`:1424-1426, 1437-1485`). Thus the guard in `packages/engine/src/projection/optimizePlan.ts:2822-2831` stops only when the re-solve has no point to step toward, and retains the prior schedule (`:2808-2809, 2851-2860`). The new test injects a first feasible solve followed by `Solution limit reached` with primal status `None`, then checks two calls and preservation of the first schedule (`packages/engine/src/projection/optimizePlan.solverOutput.test.ts:86-105`). It exercises this branch without relying on a live solver run.

## 2. Dated worksheet notes — approve

The Roth worksheet's added note is at `DOCS/calculations/roth/optimizer-schedule-conversion-total.md:114`. The defaults are 5,000 nodes and 60 seconds, both passed to HiGHS (`packages/engine/src/strategies/optimizer.ts:1354-1357, 1392-1405`); the resulting statuses are `node-limit` and `timeout` (`:1365-1379`). The page maps these to “search limit” and “time limit” (`packages/planner-ui/src/planner/optimizePageRecommendation.ts:55-68`), uses `endingAfterTax === null` to choose its no-schedule explanation (`packages/planner-ui/src/planner/OptimizePage.tsx:415-429`), and chooses the corresponding heading (`:798-810`). The roughly eight-second rmd-irmaa result is explicitly attributed to the deriver's machine, not asserted as a universal duration. The time limit can fire first on a slower machine, as the optimizer's option contract says (`packages/engine/src/strategies/optimizer.ts:518-522`). The note dates the earlier account and table rather than changing the record's conversion-total formula (`DOCS/calculations/roth/optimizer-schedule-conversion-total.md:3, 77, 112-116`).

The claim-age worksheet's addition is at `DOCS/calculations/optimizer-and-comparisons/claim-age-co-optimization-estate-gain.md:81`. Its node-limit status and 5,000-node default match the same optimizer lines. Its re-execution and unchanged evidence figures are reported as dated evidence, not a change to the claim-age gain definition, which remains joint estate minus current-claim estate (`:3, 24-45`). No code statement contradicts either note.

## 3. Grammar fix — approve

`ROUND2.diff` changes only “whose the stop” to “whose stop” in the same string literal (`packages/engine/src/rules/calculations/optimizerAndComparisons.ts:782`). The node-limit, incumbent, timing, and measurement claims in that sentence are otherwise identical. It changes no meaning.

No tests were run, as requested.
