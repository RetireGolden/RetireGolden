# Mutation receipt: monte-carlo-funding-rates

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-ten` at base `f12eba6d`, and re-executed 2026-09-22 against RetireGolden base `4fe87f00` (branch `claude/b1-p4-cards-nine-ten`, pull request #729), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/run.ts`

```diff
diff --git a/packages/engine/src/montecarlo/run.ts b/packages/engine/src/montecarlo/run.ts
index 6230e828..592e068c 100644
--- a/packages/engine/src/montecarlo/run.ts
+++ b/packages/engine/src/montecarlo/run.ts
@@ -541,7 +541,7 @@ export function aggregateMonteCarlo(result: MonteCarloPathsResult, histogramBins
     averageAnnualTargetShortfall: paths.length === 0 ? 0 : averageAnnualTargetShortfallTotal / paths.length,
     p90AverageAnnualTargetShortfall: percentile(averageTargetShortfalls, 90),
     averageYearsBelowTarget: paths.length === 0 ? 0 : yearsBelowTargetTotal / paths.length,
-    idealFundingRate: idealIntendedTotal > 0 ? idealFundedTotal / idealIntendedTotal : 1,
+    idealFundingRate: idealIntendedTotal > 0 ? idealFundedTotal / idealIntendedTotal : 0,
     excessFundingRate: excessIntendedTotal > 0 ? excessFundedTotal / excessIntendedTotal : 1,
     flexibleGoals,
     guardrailActionCounts,
```

Treats a zero total intended amount as a zero rate rather than as fully funded — the worksheet's third wrong reading, which is exactly what its all-zero-intended second case exists to catch. The four-path case is untouched, so only the second case fails.

## Command

From `packages/engine` (the `npx` and `.cmd` shims do not work in this worktree):

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/montecarlo/run.evidence.test.ts
```

## Captured failing output

Re-executed for D-RECEIPT-DRIFT because its diff was a text substitution that named no line (it is now the git diff of the same substitution); the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (run.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine9/packages/engine

 ❯ src/montecarlo/run.evidence.test.ts (16 tests | 1 failed) 9ms
   ❯ monte-carlo-funding-rates — Ideal and excess funding rates, and the flexible-goal totals (3)
     × reports both rates as 1 when every path intended nothing 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 15 passed (16)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/run.evidence.test.ts > monte-carlo-funding-rates — Ideal and excess funding rates, and the flexible-goal totals > reports both rates as 1 when every path intended nothing
AssertionError: idealFundingRate with nothing intended 0 is not within {"abs":1e-9} of the worksheet's 1: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/montecarlo/run.evidence.test.ts:78:5
     76|     withinTolerance(actual, expected, tolerance),
     77|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     78|   ).toBe(true)
       |     ^
     79| }
     80|
 ❯ src/montecarlo/run.evidence.test.ts:631:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/run.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/run.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
