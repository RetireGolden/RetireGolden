# Mutation receipt: historical-stress-window-total-shortfall

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-thirteen` at base `1452ae11`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/historicalSuites.ts`

```diff
diff --git a/packages/engine/src/montecarlo/historicalSuites.ts b/packages/engine/src/montecarlo/historicalSuites.ts
index 7d099109..3d735a32 100644
--- a/packages/engine/src/montecarlo/historicalSuites.ts
+++ b/packages/engine/src/montecarlo/historicalSuites.ts
@@ -96,7 +96,7 @@ function historicalReplaySeries(args: {
 }
 
 function total(result: ProjectionResult, pick: (year: ProjectionResult['years'][number]) => number): number {
-  return result.years.reduce((sum, year) => sum + pick(year), 0)
+  return result.years.slice(0, -1).reduce((sum, year) => sum + pick(year), 0)
 }
 
 function suiteName(kind: HistoricalStressSuiteKind, windowLength: number): string {
```

Stop the fold one year short of the horizon — the worksheet's second wrong reading, "stopping after the account first empties omits Year 3". The window reports $20,000 instead of $80,000, and the $60,000 the plan could not fund in its final year simply disappears from the stress result.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/montecarlo/historicalSuites.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #730: the branch was renamed for the pull request, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (historicalSuites.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/montecarlo/historicalSuites.evidence.test.ts (1 test | 1 failed) 116ms
   ❯ historical-stress-window-total-shortfall — Historical stress window total shortfall (1)
     × sums 0, 20000 and 60000 to 80000 over the replayed 2000-2002 window 115ms

 Test Files  1 failed (1)
      Tests  1 failed (1)

  Transform  transforming modules took 2.37s · 42% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/historicalSuites.evidence.test.ts > historical-stress-window-total-shortfall — Historical stress window total shortfall > sums 0, 20000 and 60000 to 80000 over the replayed 2000-2002 window
AssertionError: totalShortfall 20000 is not within {"abs":0.005} of 80000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/montecarlo/historicalSuites.evidence.test.ts:44:9
     42|         withinTolerance(actual, target, example.tolerance),
     43|         `${label} ${actual} is not within ${JSON.stringify(example.tol…
     44|       ).toBe(true)
       |         ^
     45|     }
     46|
 ❯ src/montecarlo/historicalSuites.evidence.test.ts:81:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/historicalSuites.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/historicalSuites.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
