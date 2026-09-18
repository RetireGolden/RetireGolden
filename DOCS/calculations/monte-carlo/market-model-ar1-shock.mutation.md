# Mutation receipt: market-model-ar1-shock

Re-executed 2026-09-18 after the #719 review against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/marketModels.ts`

```diff
--- a/packages/engine/src/montecarlo/marketModels.ts
+++ b/packages/engine/src/montecarlo/marketModels.ts
@@ mutation @@
-const shock = phi * prevShock + sigma * eps
+const shock = (1 - phi) * prevShock + sigma * eps
```

Uses 1-phi as persistence, the worksheet's first wrong reading: after a 10-point shock the next year is 8 rather than 2.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 npx.cmd vitest run src/montecarlo/marketModels.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1 FORCE_COLOR=0`. The `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-s3/packages/engine

 ❯ src/montecarlo/marketModels.evidence.test.ts (16 tests | 1 failed) 8ms
   ❯ market-model-ar1-shock — AR(1) mean-reverting return shock (1)
     × after a 10-point shock, two zero-innovation years are 2 then 0.4 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 15 passed (16)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/marketModels.evidence.test.ts > market-model-ar1-shock — AR(1) mean-reverting return shock > after a 10-point shock, two zero-innovation years are 2 then 0.4
AssertionError: nextShocksPct[0] 8.000000000000002 is not within {"abs":1e-12} of the worksheet's 2: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/marketModels.evidence.test.ts:94:11
     92|           withinTolerance(shock, value, example.tolerance),
     93|           `nextShocksPct[${index}] ${shock} is not within ${JSON.strin…
     94|         ).toBe(true)
       |           ^
     95|       })
     96|     })
 ❯ src/montecarlo/marketModels.evidence.test.ts:89:16

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

`git checkout -- packages/engine/src/montecarlo/marketModels.ts`, then `git diff --quiet -- packages/engine/src/montecarlo/marketModels.ts` exited 0, confirming no change to production code after the run.
