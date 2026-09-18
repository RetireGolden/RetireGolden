# Mutation receipt: market-model-garch-variance

Re-executed 2026-09-18 after the worksheet re-derivation against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/marketModels.ts`

```diff
--- a/packages/engine/src/montecarlo/marketModels.ts
+++ b/packages/engine/src/montecarlo/marketModels.ts
@@ mutation @@
-        const sig = Math.sqrt(Math.max(1e-9, sigma2)) * scale * 5 // tune
+        const sig = Math.sqrt(Math.max(1e-9, sigma2)) * scale // tune
```

Omits the fixed factor 5, so the year-1 published shock is 100.0039999200032% rather than 500.019999600016% (the worksheet's third wrong reading).

## Command

```
NO_COLOR=1 FORCE_COLOR=0 npx.cmd vitest run src/montecarlo/marketModels.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1 FORCE_COLOR=0`. The `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-s3/packages/engine

 ❯ src/montecarlo/marketModels.evidence.test.ts (14 tests | 1 failed) 8ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

   ❯ market-model-garch-variance — GARCH(1,1) variance recursion (1)
     × two-year published shocks 500.019999600016 then 518.4269476020705 with inflation 0 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 13 passed (14)

 FAIL  src/montecarlo/marketModels.evidence.test.ts > market-model-garch-variance — GARCH(1,1) variance recursion > two-year published shocks 500.019999600016 then 518.4269476020705 with inflation 0
AssertionError: returnShockPct[0] 100.0039999200032 is not within {"abs":1e-9} of the worksheet's 500.019999600016: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/marketModels.evidence.test.ts:260:11
    258|           withinTolerance(shock, value, example.tolerance),
    259|           `returnShockPct[${index}] ${shock} is not within ${JSON.stri…
    260|         ).toBe(true)
       |           ^
    261|       })
    262|       expectedInflation.forEach((value, index) => {
 ❯ src/montecarlo/marketModels.evidence.test.ts:255:22

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

`git checkout -- packages/engine/src/montecarlo/marketModels.ts`, then `git diff --quiet -- packages/engine/src/montecarlo/marketModels.ts` exited 0, confirming no change to production code after the run.
