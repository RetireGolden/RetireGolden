# Mutation receipt: market-model-historical-centered-bootstrap

Re-executed 2026-09-18 after the second #719 review against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/marketModels.ts`

```diff
--- a/packages/engine/src/montecarlo/marketModels.ts
+++ b/packages/engine/src/montecarlo/marketModels.ts
@@ mutation @@
-        returnShockPct[i] = portfolioReturnPct(sample, equityWeightPct) - mean
+        returnShockPct[i] = portfolioReturnPct(sample, equityWeightPct)
```

Returns the raw 1928 blend 26.599999999999998 as the centered shock, failing to subtract the dataset mean (the worksheet's third wrong reading).

## Command

```
NO_COLOR=1 FORCE_COLOR=0 npx.cmd vitest run src/montecarlo/marketModels.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1 FORCE_COLOR=0`. The `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-s3/packages/engine

 ❯ src/montecarlo/marketModels.evidence.test.ts (16 tests | 1 failed) 9ms
   ❯ market-model-historical-centered-bootstrap — Centered historical bootstrap shock (1)
     × 1928 at 60% equity is shock 17.662708333333327 and inflation −1.2% 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 15 passed (16)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/marketModels.evidence.test.ts > market-model-historical-centered-bootstrap — Centered historical bootstrap shock > 1928 at 60% equity is shock 17.662708333333327 and inflation −1.2%
AssertionError: returnShockPct 26.599999999999998 is not within {"abs":1e-12} of the worksheet's 17.662708333333327: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/marketModels.evidence.test.ts:332:9
    330|         withinTolerance(shock, expectedShock, example.tolerance),
    331|         `returnShockPct ${shock} is not within ${JSON.stringify(exampl…
    332|       ).toBe(true)
       |         ^
    333|       expect(
    334|         withinTolerance(inflation, expectedInflation, example.toleranc…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

`git checkout -- packages/engine/src/montecarlo/marketModels.ts`, then `git diff --quiet -- packages/engine/src/montecarlo/marketModels.ts` exited 0, confirming no change to production code after the run.
