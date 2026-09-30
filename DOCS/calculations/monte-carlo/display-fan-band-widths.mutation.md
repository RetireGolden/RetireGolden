# Mutation receipt: monte-carlo-fan-chart-ranges

Executed 2026-09-27 against RetireGolden base `2c35d2b8` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `da378d9b` (branch `claude/people-order-and-scenarios`; no pull request is open yet), and re-executed 2026-09-30 against RetireGolden base `fbc9a9d3` (branch `claude/ui-relocations-six`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/run.ts`

```diff
diff --git a/packages/engine/src/montecarlo/run.ts b/packages/engine/src/montecarlo/run.ts
index 46dbbe43..682b224b 100644
--- a/packages/engine/src/montecarlo/run.ts
+++ b/packages/engine/src/montecarlo/run.ts
@@ -423,5 +423,5 @@
     p50: percentile(sorted, 50),
     p75: percentile(sorted, 75),
-    p90: percentile(sorted, 90),
+    p90: percentile(sorted, 75),
   }
 }
```

Publishes the 75th percentile as the fan row's p90, so the outer band would stop at the inner band's top: the row's outer range reads $400,000 to $1,000,000 instead of $400,000 to $1,300,000.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/montecarlo/run.fanRanges.evidence.test.ts
```

## Captured failing output

Re-executed because the census freeze additions (B2-P1) added MonteCarloSummary.lastingPathCount and medianFirstDepletionYear to run.ts, which moved the production lines this receipt quotes; the mutation is unchanged. The baseline is green (run.fanRanges.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/montecarlo/run.fanRanges.evidence.test.ts (1 test | 1 failed) 6ms
   ❯ monte-carlo-fan-chart-ranges — Fan chart percentile ranges (1)
     × draws the outer band from p10 to p90 and the inner from p25 to p75 of the fan row, not their widths 5ms

 Test Files  1 failed (1)
      Tests  1 failed (1)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/run.fanRanges.evidence.test.ts > monte-carlo-fan-chart-ranges — Fan chart percentile ranges > draws the outer band from p10 to p90 and the inner from p25 to p75 of the fan row, not their widths
AssertionError: expected [ 400000, 1000000 ] to deeply equal [ 400000, 1300000 ]

- Expected
+ Received

  [
    400000,
-   1300000,
+   1000000,
  ]

 ❯ src/montecarlo/run.fanRanges.evidence.test.ts:62:34
     60|       const row = aggregateMonteCarlo(result).fan[0]!
     61|       expect(row.year).toBe(inputs.year)
     62|       expect([row.p10, row.p90]).toEqual(expected.outer)
       |                                  ^
     63|       expect([row.p25, row.p75]).toEqual(expected.inner)
     64|       expect(row.p50).toBe(expected.median)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/run.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/run.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
