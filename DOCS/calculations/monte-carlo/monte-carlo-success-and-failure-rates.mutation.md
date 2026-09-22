# Mutation receipt: monte-carlo-success-and-failure-rates

Executed 2026-09-18 against RetireGolden base `f12eba6d` (branch claude/b1-p4-cards-slice-ten) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/run.ts`

```diff
--- a/packages/engine/src/montecarlo/run.ts
+++ b/packages/engine/src/montecarlo/run.ts
@@ aggregateMonteCarlo, per-path loop @@
-    if (p.depletionYear === null) successes++
+    if (p.depletionYear === null || p.requiredFloorMet) successes++
     else {
```

Counts a path as a success when it funded the required floor even though it depleted, so only a path that both depletes and misses the floor is a failure — the worksheet's third wrong reading.

## Command

From `packages/engine` (the `npx` and `.cmd` shims do not work in this worktree):

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/montecarlo/run.evidence.test.ts
```

## Captured failing output

Executed 2026-09-18 by the orchestrator: the implementing session's writes to the production file were refused by its permission classifier, so the prepared diff was applied as written here. The baseline is green (run.evidence.test.ts passes on unmodified production). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-s10/packages/engine

 ❯ src/montecarlo/run.evidence.test.ts (16 tests | 5 failed) 11ms
   ❯ monte-carlo-success-and-failure-rates — Success, required-floor, target-lifestyle and failure rates (2)
     × scores three non-depleting, three floor-funded and one target-funded path out of five 5ms
     × holds the three tests apart path by path, so the shared 0.6 is not a coincidence 1ms
   ❯ monte-carlo-depletion-distribution — Depletion-year histogram across paths (1)
     × groups the two 2031 depletions and the 2033 depletion, leaving the two successes out 1ms
   ❯ monte-carlo-shortfall-statistics — Shortfall averages, p90s, and expected shortfall on failing paths (2)
     × conditions expected shortfall on the two depleted paths, at $35 rather than the all-path $36 0ms
   ❯ monte-carlo-depletion-probability-by-year — Depletion probability and cumulative probability by year (1)
     × divides each depletion year by all six paths and runs the cumulative sum to 2/3 1ms

 Test Files  1 failed (1)
      Tests  5 failed | 11 passed (16)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 5 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/run.evidence.test.ts > monte-carlo-success-and-failure-rates — Success, required-floor, target-lifestyle and failure rates > scores three non-depleting, three floor-funded and one target-funded path out of five
AssertionError: successRate 0.8 is not within {"abs":1e-9} of the worksheet's 0.6: expected false to be true // Object.is equality

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
 ❯ src/montecarlo/run.evidence.test.ts:122:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/5]⎯

 FAIL  src/montecarlo/run.evidence.test.ts > monte-carlo-success-and-failure-rates — Success, required-floor, target-lifestyle and failure rates > holds the three tests apart path by path, so the shared 0.6 is not a coincidence
AssertionError: D success: expected 1 to be +0 // Object.is equality

- Expected
+ Received

- 0
+ 1

 ❯ src/montecarlo/run.evidence.test.ts:145:57
    143|       for (const [label, row] of Object.entries(rows)) {
    144|         const summary = aggregateMonteCarlo(resultOf(startYear, endYea…
    145|         expect(summary.successRate, `${label} success`).toBe(row.deple…
       |                                                         ^
    146|         expect(summary.requiredFloorSuccessRate, `${label} required fl…
    147|         expect(summary.targetLifestyleSuccessRate, `${label} target li…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/5]⎯

 FAIL  src/montecarlo/run.evidence.test.ts > monte-carlo-depletion-distribution — Depletion-year histogram across paths > groups the two 2031 depletions and the 2033 depletion, leaving the two successes out
AssertionError: expected [] to deeply equal [ { year: 2031, count: 2 }, …(1) ]

- Expected
+ Received

- [
-   {
-     "count": 2,
-     "year": 2031,
-   },
-   {
-     "count": 1,
-     "year": 2033,
-   },
- ]
+ []

 ❯ src/montecarlo/run.evidence.test.ts:304:43
    302|     it('groups the two 2031 depletions and the 2033 depletion, leaving…
    303|       const summary = aggregateMonteCarlo(resultOf(startYear, endYear,…
    304|       expect(summary.depletionYearCounts).toEqual(example.expected.dep…
       |                                           ^
    305|     })
    306|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/5]⎯

 FAIL  src/montecarlo/run.evidence.test.ts > monte-carlo-shortfall-statistics — Shortfall averages, p90s, and expected shortfall on failing paths > conditions expected shortfall on the two depleted paths, at $35 rather than the all-path $36
AssertionError: expected +0 to be 2 // Object.is equality

- Expected
+ Received

- 2
+ 0

 ❯ src/montecarlo/run.evidence.test.ts:418:53
    416|       // The conditional average is only the worksheet's $35 if it ran…
    417|       // and D alone; path E carries the largest shortfall and never d…
    418|       expect(summary.downsideRisk.failingPathCount).toBe(2)
       |                                                     ^
    419|       expectWithin(
    420|         summary.downsideRisk.expectedShortfallDollars,

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/5]⎯

 FAIL  src/montecarlo/run.evidence.test.ts > monte-carlo-depletion-probability-by-year — Depletion probability and cumulative probability by year > divides each depletion year by all six paths and runs the cumulative sum to 2/3
AssertionError: expected [] to have a length of 3 but got +0

- Expected
+ Received

- 3
+ 0

 ❯ src/montecarlo/run.evidence.test.ts:723:50
    721|     it('divides each depletion year by all six paths and runs the cumu…
    722|       const summary = aggregateMonteCarlo(resultOf(startYear, endYear,…
    723|       expect(summary.depletionProbabilityByYear).toHaveLength(expected…
       |                                                  ^
    724|       expected.forEach((row, index) => {
    725|         const actual = summary.depletionProbabilityByYear[index]!

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/5]⎯
```

## Revert

Not needed: no production file was modified. `git diff --quiet -- packages/engine/src/montecarlo/run.ts` exits 0.
