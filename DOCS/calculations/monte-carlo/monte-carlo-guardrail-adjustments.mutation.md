# Mutation receipt: monte-carlo-guardrail-adjustments

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-ten` at base `f12eba6d`, and re-executed 2026-09-22 against RetireGolden base `4fe87f00` (branch `claude/b1-p4-cards-nine-ten`, pull request #729), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `fe28be3c` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `b2897dfe` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `da378d9b` (branch `claude/people-order-and-scenarios`; no pull request is open yet), and re-executed 2026-09-30 against RetireGolden base `fbc9a9d3` (branch `claude/ui-relocations-six`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/run.ts`

```diff
diff --git a/packages/engine/src/montecarlo/run.ts b/packages/engine/src/montecarlo/run.ts
index 46dbbe43..45eb9389 100644
--- a/packages/engine/src/montecarlo/run.ts
+++ b/packages/engine/src/montecarlo/run.ts
@@ -559,7 +559,7 @@ export function aggregateMonteCarlo(result: MonteCarloPathsResult, histogramBins
     pathsWithRaise: share(pathsWithRaise),
     medianMaxCutDepth: percentile(cutDepths, 50),
     p90MaxCutDepth: percentile(cutDepths, 90),
-    averageCutYears: pathsWithCut === 0 ? 0 : cutYearCounts.reduce((a, b) => a + b, 0) / pathsWithCut,
+    averageCutYears: paths.length === 0 ? 0 : cutYearCounts.reduce((a, b) => a + b, 0) / paths.length,
     p90CutYears: percentile(cutYearCounts, 90),
     averageLongestCutSpellYears: pathsWithCut === 0 ? 0 : cutSpellTotal / pathsWithCut,
     probEndingSurplus: share(surplusPaths),
```

Divides the conditional cut-year total by all five paths instead of by the three that cut — the worksheet's first wrong reading.

## Command

From `packages/engine` (the `npx` and `.cmd` shims do not work in this worktree):

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/montecarlo/run.evidence.test.ts
```

## Captured failing output

Re-executed because the census freeze additions (B2-P1) added MonteCarloSummary.lastingPathCount and medianFirstDepletionYear to run.ts, which moved the production lines this receipt quotes; the mutation is unchanged. The baseline is green (run.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/montecarlo/run.evidence.test.ts (16 tests | 1 failed) 9ms
   ❯ monte-carlo-guardrail-adjustments — Guardrail adjustment shares, depths, durations and ending surplus (2)
     × conditions the cut statistics on the three cut paths and shares the rest over all five 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 15 passed (16)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/run.evidence.test.ts > monte-carlo-guardrail-adjustments — Guardrail adjustment shares, depths, durations and ending surplus > conditions the cut statistics on the three cut paths and shares the rest over all five
AssertionError: adjustments.averageCutYears 2.8 is not within {"abs":1e-9} of the worksheet's 4.666666666666667: expected false to be true // Object.is equality

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
 ❯ src/montecarlo/run.evidence.test.ts:514:9

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/run.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/run.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
