# Mutation receipt: monte-carlo-funding-rates

Executed 2026-09-18 against RetireGolden base `f12eba6d` (branch claude/b1-p4-cards-slice-ten) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/run.ts`

```diff
--- a/packages/engine/src/montecarlo/run.ts
+++ b/packages/engine/src/montecarlo/run.ts
@@ aggregateMonteCarlo, returned summary @@
-    idealFundingRate: idealIntendedTotal > 0 ? idealFundedTotal / idealIntendedTotal : 1,
+    idealFundingRate: idealIntendedTotal > 0 ? idealFundedTotal / idealIntendedTotal : 0,
```

Treats a zero total intended amount as a zero rate rather than as fully funded — the worksheet's third wrong reading, which is exactly what its all-zero-intended second case exists to catch. The four-path case is untouched, so only the second case fails.

## Command

From `packages/engine` (the `npx` and `.cmd` shims do not work in this worktree):

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/montecarlo/run.evidence.test.ts
```

## Captured failing output

Executed 2026-09-18 by the orchestrator: the implementing session's writes to the production file were refused by its permission classifier, so the prepared diff was applied as written here. The baseline is green (run.evidence.test.ts passes on unmodified production). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-s10/packages/engine

 ❯ src/montecarlo/run.evidence.test.ts (16 tests | 1 failed) 10ms
   ❯ monte-carlo-funding-rates — Ideal and excess funding rates, and the flexible-goal totals (3)
     × reports both rates as 1 when every path intended nothing 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 15 passed (16)

  Transform  transforming modules took 2.01s · 42% of tracked time, re-done on every run
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

Not needed: no production file was modified. `git diff --quiet -- packages/engine/src/montecarlo/run.ts` exits 0.
