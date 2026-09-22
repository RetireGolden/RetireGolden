# Mutation receipt: projection-summary-average-pre-retirement-savings-rate

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-seven` at base `74916a7e`, and re-executed 2026-09-22 against RetireGolden base `7ae019a8` (branch `claude/b1-p4-cards-seven`, pull request #727) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/compare.ts`

```diff
diff --git a/packages/engine/src/projection/compare.ts b/packages/engine/src/projection/compare.ts
index 893060b3..792c71ba 100644
--- a/packages/engine/src/projection/compare.ts
+++ b/packages/engine/src/projection/compare.ts
@@ -320,7 +320,7 @@ export function summarizeProjection(plan: Plan, result: ProjectionResult): Proje
   const preRetirementRates = savingsRates.filter((r) => r.year < targetYear)
   const averagePreRetirementSavingsRatePct =
     preRetirementRates.length > 0
-      ? preRetirementRates.reduce((acc, r) => acc + r.ratePct, 0) / preRetirementRates.length
+      ? preRetirementRates.reduce((acc, r) => acc + r.ratePct, 0) / (preRetirementRates.length + 1)
       : 0

   // 3. FI Number
```

Divide by calendar boundaries rather than represented working years.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/compareSummary.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #727: the heir-tax fixture had grown to two cases since the first execution and the branch was renamed for the pull request, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (compareSummary.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/compareSummary.evidence.test.ts (15 tests | 1 failed) 19ms
   ❯ projection-summary-average-pre-retirement-savings-rate — Projection summary average pre retirement savings rate (2)
     × averages 10, 20 and 35 over three working years, unweighted 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 14 passed (15)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/compareSummary.evidence.test.ts > projection-summary-average-pre-retirement-savings-rate — Projection summary average pre retirement savings rate > averages 10, 20 and 35 over three working years, unweighted
AssertionError: averagePreRetirementSavingsRatePct: actual 16.25, worksheet 21.6666666666667: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/compareSummary.evidence.test.ts:476:9
    474|         withinTolerance(summary.averagePreRetirementSavingsRatePct, ex…
    475|         `averagePreRetirementSavingsRatePct: actual ${summary.averageP…
    476|       ).toBe(true)
       |         ^
    477|     })
    478|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/compare.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/compare.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
