# Mutation receipt: monte-carlo-shortfall-statistics

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-ten` at base `f12eba6d`, and re-executed 2026-09-22 against RetireGolden base `4fe87f00` (branch `claude/b1-p4-cards-nine-ten`, pull request #729), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `fe28be3c` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `b2897dfe` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `da378d9b` (branch `claude/people-order-and-scenarios`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/run.ts`

```diff
diff --git a/packages/engine/src/montecarlo/run.ts b/packages/engine/src/montecarlo/run.ts
index c12606f1..0b055a69 100644
--- a/packages/engine/src/montecarlo/run.ts
+++ b/packages/engine/src/montecarlo/run.ts
@@ -568,7 +568,7 @@ export function aggregateMonteCarlo(result: MonteCarloPathsResult, histogramBins
     downsideRisk: {
       failureRate: share(failingPathCount),
       failingPathCount,
-      expectedShortfallDollars: failingPathCount === 0 ? 0 : failingPathShortfallTotal / failingPathCount,
+      expectedShortfallDollars: paths.length === 0 ? 0 : totalShortfallTotal / paths.length,
       expectedRequiredShortfallDollars:
         failingPathCount === 0 ? 0 : failingPathRequiredShortfallTotal / failingPathCount,
       expectedTargetShortfallDollars: failingPathCount === 0 ? 0 : failingPathTargetShortfallTotal / failingPathCount,
```

Averages the expected shortfall over all five paths instead of conditioning it on the two that depleted — the worksheet's second wrong reading.

## Command

From `packages/engine` (the `npx` and `.cmd` shims do not work in this worktree):

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/montecarlo/run.evidence.test.ts
```

## Captured failing output

Re-executed because decisions D-PEOPLE-ORDER and D-FI-CONVERSION-TAX moved the production lines or the evidence test lines this receipt quotes; the mutation is unchanged. The baseline is green (run.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine19/packages/engine

 ❯ src/montecarlo/run.evidence.test.ts (16 tests | 1 failed) 14ms
   ❯ monte-carlo-shortfall-statistics — Shortfall averages, p90s, and expected shortfall on failing paths (2)
     × conditions expected shortfall on the two depleted paths, at $35 rather than the all-path $36 5ms

 Test Files  1 failed (1)
      Tests  1 failed | 15 passed (16)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/run.evidence.test.ts > monte-carlo-shortfall-statistics — Shortfall averages, p90s, and expected shortfall on failing paths > conditions expected shortfall on the two depleted paths, at $35 rather than the all-path $36
AssertionError: downsideRisk.expectedShortfallDollars 36 is not within {"abs":1e-9} of the worksheet's 35: expected false to be true // Object.is equality

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
 ❯ src/montecarlo/run.evidence.test.ts:419:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/run.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/run.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
