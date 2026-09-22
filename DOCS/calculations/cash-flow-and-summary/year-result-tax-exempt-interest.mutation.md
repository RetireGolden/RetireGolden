# Mutation receipt: year-result-tax-exempt-interest

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eleven` at base `60e47fd8`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualAggregateRothConversionPhase.ts`

```diff
@@ -372,10 +372,8 @@
   // Cash and balances always follow generated only.
   const yearTaxExemptInterest =
     acaActive && acaContract?.taxExemptInterest.state === 'known'
-      ? Math.max(
-        Math.max(0, acaContract.taxExemptInterest.amount ?? 0),
-        generatedTaxExemptInterest,
-      )
+      ? Math.max(0, acaContract.taxExemptInterest.amount ?? 0) +
+        generatedTaxExemptInterest
       : generatedTaxExemptInterest
   const acaForeignExclusionAddback =
     acaActive && acaContract?.foreignExclusionAddback.state === 'known'
```

This adds the attested household total to the plan-generated subset instead of taking the greater, publishing $10,000 in the ACA-contract year — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/simulate.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #730: the branch was renamed for the pull request, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (simulate.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/simulate.evidence.test.ts (9 tests | 1 failed) 52ms
   ❯ year-result-tax-exempt-interest — Annual tax-exempt interest, and the ACA-year maximum (2)
     × publishes the larger attested 6000 in a known ACA contract year, never the sum 6ms

 Test Files  1 failed (1)
      Tests  1 failed | 8 passed (9)

  Transform  transforming modules took 2.44s · 44% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/simulate.evidence.test.ts > year-result-tax-exempt-interest — Annual tax-exempt interest, and the ACA-year maximum > publishes the larger attested 6000 in a known ACA contract year, never the sum
AssertionError: Case B taxExemptInterest 10000 is not within {"abs":0.005} of the worksheet's 6000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/simulate.evidence.test.ts:35:5
     33|     withinTolerance(actual, target, tolerance),
     34|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     35|   ).toBe(true)
       |     ^
     36| }
     37|
 ❯ src/projection/simulate.evidence.test.ts:682:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/annualAggregateRothConversionPhase.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/annualAggregateRothConversionPhase.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
