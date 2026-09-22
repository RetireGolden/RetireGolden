# Mutation receipt: historical-stress-window-total-shortfall

Executed 2026-09-18 against RetireGolden base `1452ae11` (branch `claude/b1-p4-cards-slice-thirteen`) in `packages/engine`.

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

Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and cache-hint lines were removed. Exit code: 1.

```

 RUN  v5.0.0 C:/TEMP/rg-s13/packages/engine

 ❯ src/montecarlo/historicalSuites.evidence.test.ts (1 test | 1 failed) 95ms
   ❯ historical-stress-window-total-shortfall — Historical stress window total shortfall (1)
     × sums 0, 20000 and 60000 to 80000 over the replayed 2000-2002 window 94ms

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


 Test Files  1 failed (1)
      Tests  1 failed (1)
```

## Revert

`git checkout -- packages/engine/src/montecarlo/historicalSuites.ts` restored the file, and `git diff --quiet -- packages/engine/src/montecarlo/historicalSuites.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the named file passed again (1 passed, exit 0).
