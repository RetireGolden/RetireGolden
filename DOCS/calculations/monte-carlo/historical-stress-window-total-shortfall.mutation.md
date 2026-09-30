# Mutation receipt: historical-stress-window-total-shortfall

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-thirteen` at base `1452ae11`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730), and re-executed 2026-09-26 against RetireGolden base `fe6233de` (branch `claude/monte-carlo-models`; no pull request is open yet), and re-executed 2026-09-26 against RetireGolden base `00c28120` (branch `claude/monte-carlo-models`, pull request #746), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/historicalSuites.ts`

```diff
diff --git a/packages/engine/src/montecarlo/historicalSuites.ts b/packages/engine/src/montecarlo/historicalSuites.ts
index 7c93ee2a..76e27abf 100644
--- a/packages/engine/src/montecarlo/historicalSuites.ts
+++ b/packages/engine/src/montecarlo/historicalSuites.ts
@@ -97,7 +97,7 @@ function historicalReplaySeries(args: {
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

Re-executed for D-RECEIPT-DRIFT because its hunk header named a line its production code has since moved from; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (historicalSuites.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/montecarlo/historicalSuites.evidence.test.ts (4 tests | 1 failed) 168ms
   ❯ historical-stress-window-total-shortfall — Historical stress window total shortfall (4)
     × sums 0, 20000 and 60000 to 80000 over the replayed 2000-2002 window 99ms

 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)

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
