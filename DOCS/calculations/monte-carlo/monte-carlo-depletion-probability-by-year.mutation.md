# Mutation receipt: monte-carlo-depletion-probability-by-year

Executed 2026-09-18 against RetireGolden base `f12eba6d` (branch claude/b1-p4-cards-slice-ten) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/run.ts`

```diff
--- a/packages/engine/src/montecarlo/run.ts
+++ b/packages/engine/src/montecarlo/run.ts
@@ aggregateMonteCarlo, depletionProbabilityByYear @@
   const depletionProbabilityByYear = depletionYearCounts.map(({ year, count }) => {
-    const probability = share(count)
+    const probability = failingPathCount === 0 ? 0 : count / failingPathCount
```

Divides each year's count by the failing paths alone instead of by every path — the worksheet's first wrong reading, the one the two successes in the fixture exist to expose.

## Command

From `packages/engine` (the `npx` and `.cmd` shims do not work in this worktree):

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/montecarlo/run.evidence.test.ts
```

## Captured failing output

Executed 2026-09-18 by the orchestrator: the implementing session's writes to the production file were refused by its permission classifier, so the prepared diff was applied as written here. The baseline is green (run.evidence.test.ts passes on unmodified production). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-s10/packages/engine

 ❯ src/montecarlo/run.evidence.test.ts (16 tests | 1 failed) 8ms
   ❯ monte-carlo-depletion-probability-by-year — Depletion probability and cumulative probability by year (1)
     × divides each depletion year by all six paths and runs the cumulative sum to 2/3 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 15 passed (16)

  Transform  transforming modules took 2.00s · 42% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/run.evidence.test.ts > monte-carlo-depletion-probability-by-year — Depletion probability and cumulative probability by year > divides each depletion year by all six paths and runs the cumulative sum to 2/3
AssertionError: row 0 probability 0.25 is not within {"abs":1e-9} of the worksheet's 0.16666666666666666: expected false to be true // Object.is equality

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
 ❯ src/montecarlo/run.evidence.test.ts:728:9
 ❯ src/montecarlo/run.evidence.test.ts:724:16

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

Not needed: no production file was modified. `git diff --quiet -- packages/engine/src/montecarlo/run.ts` exits 0.
