# Mutation receipt: scenario-lifetime-tax-and-penalties

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-seven` at base `74916a7e`, and re-executed 2026-09-22 against RetireGolden base `7ae019a8` (branch `claude/b1-p4-cards-seven`, pull request #727), and re-executed 2026-09-26 against RetireGolden base `5d3a72b1` (branch `claude/solver-answers-unpriced-aca`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `2c780ae5` (branch `claude/solver-answers-unpriced-aca`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `fe28be3c` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `2c35d2b8` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `b2897dfe` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `373a40f0` (branch `claude/b2p1-slice3-comparisons`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/scenarios/comparison.ts`

```diff
diff --git a/packages/engine/src/scenarios/comparison.ts b/packages/engine/src/scenarios/comparison.ts
index 9cb72a3d..af4aee05 100644
--- a/packages/engine/src/scenarios/comparison.ts
+++ b/packages/engine/src/scenarios/comparison.ts
@@ -715,8 +715,8 @@ export function compareScenarioPlans(
       endingNetWorth: compareScalars(baselineSummary.endingNetWorth, proposalSummary.endingNetWorth),
       endingAfterTaxEstate: compareScalars(baselineSummary.endingAfterTaxEstate, proposalSummary.endingAfterTaxEstate),
       lifetimeTax: compareScalars(
-        sum(baselineResult.years, (y) => y.tax),
-        sum(proposalResult.years, (y) => y.tax),
+        sum(baselineResult.years, (y) => y.tax + y.penalties),
+        sum(proposalResult.years, (y) => y.tax + y.penalties),
       ),
       lifetimePenalties: compareScalars(
         sum(baselineResult.years, (y) => y.penalties),
```

Fold penalties into the tax channel for both scenario sides.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/scenarios/comparisonCells.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-27 on B2-P1 slice 3, which moved the lines this receipt quotes (new comparison fields, basis doc comments and helper calls in the production file, or new cases and fixture fields in the evidence file) without changing the mutation, so the hunk header, capture, blob hash and revert note are refreshed against this head. The baseline is green (comparisonCells.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/scenarios/comparisonCells.evidence.test.ts (6 tests | 1 failed) 66ms
   ❯ scenario-lifetime-tax-and-penalties — Scenario lifetime tax and penalties (1)
     × totals each side separately without mixing the tax and penalty channels 5ms

 Test Files  1 failed (1)
      Tests  1 failed | 5 passed (6)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/scenarios/comparisonCells.evidence.test.ts > scenario-lifetime-tax-and-penalties — Scenario lifetime tax and penalties > totals each side separately without mixing the tax and penalty channels
AssertionError: baseline lifetime tax: actual 31000, worksheet 29500: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/scenarios/comparisonCells.evidence.test.ts:350:11
    348|           withinTolerance(tax.baseline, expected.baselineTax, example.…
    349|           `baseline lifetime tax: actual ${tax.baseline}, worksheet ${…
    350|         ).toBe(true)
       |           ^
    351|         expect(
    352|           withinTolerance(tax.proposal, expected.proposalTax, example.…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/scenarios/comparison.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/scenarios/comparison.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
