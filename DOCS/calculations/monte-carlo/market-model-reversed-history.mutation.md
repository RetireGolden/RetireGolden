# Mutation receipt: market-model-reversed-history

Re-executed 2026-09-18 after the second #719 review against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/marketModels.ts`

```diff
--- a/packages/engine/src/montecarlo/marketModels.ts
+++ b/packages/engine/src/montecarlo/marketModels.ts
@@ mutation @@
-const winLen = Math.max(5, Math.min(HISTORICAL_YEARS.length, config.windowLengthYears ?? 10))
+const winLen = Math.max(1, Math.min(HISTORICAL_YEARS.length, config.windowLengthYears ?? 10))
```

Drops the five-year floor so requested length 3 is honored, selecting 2000–2002 and replaying [2002, 2001, 2000] instead of [2004, 2003, 2002] (the worksheet's first wrong reading).

## Command

```
NO_COLOR=1 FORCE_COLOR=0 npx.cmd vitest run src/montecarlo/marketModels.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1 FORCE_COLOR=0`. The `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-s3/packages/engine

 ❯ src/montecarlo/marketModels.evidence.test.ts (16 tests | 1 failed) 9ms
   ❯ market-model-reversed-history — Reversed-history window replay (1)
     × floors windowLengthYears 3 to 5 and replays 2004, 2003, 2002 with the worksheet shocks 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 15 passed (16)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/marketModels.evidence.test.ts > market-model-reversed-history — Reversed-history window replay > floors windowLengthYears 3 to 5 and replays 2004, 2003, 2002 with the worksheet shocks
AssertionError: returnShockPct[0] (year 2004) -16.097291666666667 is not within {"abs":1e-12} of the worksheet's -0.7172916666666698: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/marketModels.evidence.test.ts:477:11
    475|           withinTolerance(shock, value, example.tolerance),
    476|           `returnShockPct[${index}] (year ${year}) ${shock} is not wit…
    477|         ).toBe(true)
       |           ^
    478|         expect(
    479|           withinTolerance(inflation, expectedInflation[index]!, exampl…
 ❯ src/montecarlo/marketModels.evidence.test.ts:470:22

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

`git checkout -- packages/engine/src/montecarlo/marketModels.ts`, then `git diff --quiet -- packages/engine/src/montecarlo/marketModels.ts` exited 0, confirming no change to production code after the run.
