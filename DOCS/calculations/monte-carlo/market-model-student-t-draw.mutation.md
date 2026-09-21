# Mutation receipt: market-model-student-t-draw

Re-executed 2026-09-18 after the second #719 review against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/marketModels.ts`

```diff
--- a/packages/engine/src/montecarlo/marketModels.ts
+++ b/packages/engine/src/montecarlo/marketModels.ts
@@ mutation @@
-if (rng.next() < 0.05) z *= (df > 4 ? 2.5 : 3.5)
+if (rng.next() < 0.05) z *= 2.5
```

Uses multiplier 2.5 for every df, the worksheet's third wrong reading: df 3 with u 0.01 then yields 30 rather than 42.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 npx.cmd vitest run src/montecarlo/marketModels.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1 FORCE_COLOR=0`. The `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-s3/packages/engine

 ❯ src/montecarlo/marketModels.evidence.test.ts (16 tests | 1 failed) 9ms
   ❯ market-model-student-t-draw — Named student-t return shock: normal with a 5% tail-multiplier mixture (3)
     × df 3, u 0.01, z 1: shock 42 and inflation 0 3ms

 Test Files  1 failed (1)
      Tests  1 failed | 15 passed (16)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/marketModels.evidence.test.ts > market-model-student-t-draw — Named student-t return shock: normal with a 5% tail-multiplier mixture > df 3, u 0.01, z 1: shock 42 and inflation 0
AssertionError: returnShockPct 30 is not within {"abs":1e-12} of the worksheet's 42: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/marketModels.evidence.test.ts:650:9
    648|         withinTolerance(path.returnShockPct[0]!, expectedShocks[2]!, e…
    649|         `returnShockPct ${path.returnShockPct[0]} is not within ${JSON…
    650|       ).toBe(true)
       |         ^
    651|       expect(
    652|         withinTolerance(path.inflationPct[0]!, expectedInflation[2]!, …

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

`git checkout -- packages/engine/src/montecarlo/marketModels.ts`, then `git diff --quiet -- packages/engine/src/montecarlo/marketModels.ts` exited 0, confirming no change to production code after the run.
