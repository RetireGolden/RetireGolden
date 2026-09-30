# Mutation receipt: monte-carlo-lasting-path-count

Executed 2026-09-30 against RetireGolden base `fbc9a9d3` (branch `claude/ui-relocations-six`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/run.ts`

```diff
diff --git a/packages/engine/src/montecarlo/run.ts b/packages/engine/src/montecarlo/run.ts
index 46dbbe431..cb617b005 100644
--- a/packages/engine/src/montecarlo/run.ts
+++ b/packages/engine/src/montecarlo/run.ts
@@ -567,7 +567,7 @@ export function aggregateMonteCarlo(result: MonteCarloPathsResult, histogramBins
   }
   return {
     pathCount: paths.length,
-    lastingPathCount: successes,
+    lastingPathCount: requiredFloorSuccesses,
     successRate: share(successes),
     requiredFloorSuccessRate: share(requiredFloorSuccesses),
     targetLifestyleSuccessRate: share(targetLifestyleSuccesses),
```

The paths that met their required spending floor read as the paths that lasted, the worksheet's first wrong reading: case G reads 3 where 5 paths never ran out, and case A reads 10, counting the five failing paths whose floor the sample marks as met.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/montecarlo/run.lastingPaths.evidence.test.ts
```

## Captured failing output

The baseline is green (run.lastingPaths.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/montecarlo/run.lastingPaths.evidence.test.ts (5 tests | 3 failed) 7ms
   ❯ monte-carlo-lasting-path-count — Lasting and depleted path counts (5)
     × case A: 5 of 10 paths lasted and 5 ran out, and the year counts add up to the 5 4ms
     × case E: 850 of 1,000 paths lasted and 150 ran out, as the Why panel prints them 1ms
     × case G: a path that never runs out lasted even when it fell short of its required floor 0ms

 Test Files  1 failed (1)
      Tests  3 failed | 2 passed (5)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/run.lastingPaths.evidence.test.ts > monte-carlo-lasting-path-count — Lasting and depleted path counts > case A: 5 of 10 paths lasted and 5 ran out, and the year counts add up to the 5
AssertionError: expected 10 to be 5 // Object.is equality

- Expected
+ Received

- 5
+ 10

 ❯ src/montecarlo/run.lastingPaths.evidence.test.ts:77:40
     75|       const e = expected.caseA!
     76|       expect(summary.pathCount).toBe(e.pathCount)
     77|       expect(summary.lastingPathCount).toBe(e.lasting)
       |                                        ^
     78|       expect(summary.downsideRisk.failingPathCount).toBe(e.depleted)
     79|       expect(depletedSum(summary.depletionYearCounts)).toBe(e.depleted)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  src/montecarlo/run.lastingPaths.evidence.test.ts > monte-carlo-lasting-path-count — Lasting and depleted path counts > case E: 850 of 1,000 paths lasted and 150 ran out, as the Why panel prints them
AssertionError: expected 1000 to be 850 // Object.is equality

- Expected
+ Received

- 850
+ 1000

 ❯ src/montecarlo/run.lastingPaths.evidence.test.ts:94:40
     92|       const summary = aggregateMonteCarlo(result([...failing, ...lasti…
     93|       const e = expected.caseE!
     94|       expect(summary.lastingPathCount).toBe(e.lasting)
       |                                        ^
     95|       expect(summary.downsideRisk.failingPathCount).toBe(e.depleted)
     96|       expect(depletedSum(summary.depletionYearCounts)).toBe(e.depleted)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  src/montecarlo/run.lastingPaths.evidence.test.ts > monte-carlo-lasting-path-count — Lasting and depleted path counts > case G: a path that never runs out lasted even when it fell short of its required floor
AssertionError: expected 3 to be 5 // Object.is equality

- Expected
+ Received

- 5
+ 3

 ❯ src/montecarlo/run.lastingPaths.evidence.test.ts:104:40
    102|       const summary = aggregateMonteCarlo(result(paths))
    103|       const e = expected.caseG!
    104|       expect(summary.lastingPathCount).toBe(e.lasting)
       |                                        ^
    105|       expect(summary.downsideRisk.failingPathCount).toBe(e.depleted)
    106|       expect(summary.lastingPathCount).not.toBe(e.wrongFloorMet)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/run.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/run.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
