# Mutation receipt: market-model-empirical-history

Re-executed 2026-09-18 after the second #719 review against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/marketModels.ts`

```diff
--- a/packages/engine/src/montecarlo/marketModels.ts
+++ b/packages/engine/src/montecarlo/marketModels.ts
@@ mutation @@
-const mean = centered ? meanPortfolioReturnPct(equityWeightPct) : 0
+const mean = centered ? 8 : 0
```

Subtracts a round 8 instead of the dataset mean, so the 1928 centered shock is 18.599999999999998 rather than 17.662708333333327 (the worksheet's second wrong reading).

## Command

```
NO_COLOR=1 FORCE_COLOR=0 npx.cmd vitest run src/montecarlo/marketModels.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1 FORCE_COLOR=0`. The `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-s3/packages/engine

 ❯ src/montecarlo/marketModels.evidence.test.ts (16 tests | 1 failed) 9ms
   ❯ market-model-empirical-history — Empirical historical shock, centered or raw (2)
     × 1928 at 60% equity: centered shock 17.662708333333327, raw 26.599999999999998, inflation −1.2% 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 15 passed (16)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/marketModels.evidence.test.ts > market-model-empirical-history — Empirical historical shock, centered or raw > 1928 at 60% equity: centered shock 17.662708333333327, raw 26.599999999999998, inflation −1.2%
AssertionError: centeredShockPct 18.599999999999998 is not within {"abs":1e-12} of the worksheet's 17.662708333333327: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/marketModels.evidence.test.ts:197:9
    195|         withinTolerance(centered.returnShockPct[0]!, expectedCentered,…
    196|         `centeredShockPct ${centered.returnShockPct[0]} is not within …
    197|       ).toBe(true)
       |         ^
    198|       expect(
    199|         withinTolerance(raw.returnShockPct[0]!, expectedRaw, example.t…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

`git checkout -- packages/engine/src/montecarlo/marketModels.ts`, then `git diff --quiet -- packages/engine/src/montecarlo/marketModels.ts` exited 0, confirming no change to production code after the run.
