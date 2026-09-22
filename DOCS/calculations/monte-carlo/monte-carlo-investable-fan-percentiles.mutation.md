# Mutation receipt: monte-carlo-investable-fan-percentiles

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-ten` at base `f12eba6d`, and re-executed 2026-09-22 against RetireGolden base `4fe87f00` (branch `claude/b1-p4-cards-nine-ten`, pull request #729) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/run.ts`

```diff
--- a/packages/engine/src/montecarlo/run.ts
+++ b/packages/engine/src/montecarlo/run.ts
@@ aggregateMonteCarlo, fan loop @@
     column.sort((a, b) => a - b)
-    fan.push({ year: startYear + y, ...percentileSet(column) })
+    const rank = (p: number) => column[Math.floor((p / 100) * (column.length - 1))]!
+    fan.push({ year: startYear + y, p10: rank(10), p25: rank(25), p50: rank(50), p75: rank(75), p90: rank(90) })
```

Takes the fan's five levels by nearest rank instead of by interpolation at `(p/100)(n-1)` — the worksheet's first wrong reading. It is written inline so only the fan changes; every other percentile in the summary keeps the production helper.

## Command

From `packages/engine` (the `npx` and `.cmd` shims do not work in this worktree):

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/montecarlo/run.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #729: the branch was renamed for the pull request and several fixtures changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (run.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/montecarlo/run.evidence.test.ts (16 tests | 2 failed) 10ms
   ❯ monte-carlo-investable-fan-percentiles — Per-year investable balance fan (2)
     × interpolates the 2030 column at index (p/100)(n-1) to 30, 75, 200, 475 and 790 4ms
     × takes the even-sample median as the mean of the two middle balances in 2031 and 2032 1ms

 Test Files  1 failed (1)
      Tests  2 failed | 14 passed (16)

  Transform  transforming modules took 2.10s · 45% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/run.evidence.test.ts > monte-carlo-investable-fan-percentiles — Per-year investable balance fan > interpolates the 2030 column at index (p/100)(n-1) to 30, 75, 200, 475 and 790
AssertionError: fan 2030 p10 0 is not within {"abs":1e-9} of the worksheet's 30: expected false to be true // Object.is equality

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
 ❯ src/montecarlo/run.evidence.test.ts:194:9

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/montecarlo/run.evidence.test.ts > monte-carlo-investable-fan-percentiles — Per-year investable balance fan > takes the even-sample median as the mean of the two middle balances in 2031 and 2032
AssertionError: fan 2031 p50 300 is not within {"abs":1e-9} of the worksheet's 500: expected false to be true // Object.is equality

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
 ❯ src/montecarlo/run.evidence.test.ts:202:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/run.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/run.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
