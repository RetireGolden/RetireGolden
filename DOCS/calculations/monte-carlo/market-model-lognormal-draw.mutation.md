# Mutation receipt: market-model-lognormal-draw

Re-executed 2026-09-18 after the #719 review against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/marketModels.ts`

```diff
--- a/packages/engine/src/montecarlo/marketModels.ts
+++ b/packages/engine/src/montecarlo/marketModels.ts
@@ mutation @@
-        // E[exp(σz − σ²/2)] = 1: shocks average out to the expected return.
-        returnShockPct[i] = (Math.exp(sigma * z1 - (sigma * sigma) / 2) - 1) * 100
+        // E[exp(σz − σ²/2)] = 1: shocks average out to the expected return.
+        returnShockPct[i] = (Math.exp(sigma * z1 - (sigma * sigma) / 2) - 1) * 100 + 100
```

Adds 100 so a zero-vol path emits 100 rather than shock 0, the worksheet's first wrong reading (returning the gross multiplier as percent).

## Command

```
NO_COLOR=1 FORCE_COLOR=0 npx.cmd vitest run src/montecarlo/marketModels.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1 FORCE_COLOR=0`. The `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-s3/packages/engine

 ❯ src/montecarlo/marketModels.evidence.test.ts (16 tests | 1 failed) 9ms
   ❯ market-model-lognormal-draw — Mean-preserving lognormal return shock (1)
     × zero return vol and inflation 3/0 yields shock 0 and inflation 3% every year 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 15 passed (16)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/marketModels.evidence.test.ts > market-model-lognormal-draw — Mean-preserving lognormal return shock > zero return vol and inflation 3/0 yields shock 0 and inflation 3% every year
AssertionError: expected 100 to be +0 // Object.is equality

- Expected
+ Received

- 0
+ 100

 ❯ src/montecarlo/marketModels.evidence.test.ts:389:62
    387|       })
    388|       const path = seriesOf(model.generatePath(scriptedRng({ normals: …
    389|       for (const shock of path.returnShockPct) expect(shock).toBe(exam…
       |                                                              ^
    390|       for (const inflation of path.inflationPct) expect(inflation).toB…
    391|     })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

`git checkout -- packages/engine/src/montecarlo/marketModels.ts`, then `git diff --quiet -- packages/engine/src/montecarlo/marketModels.ts` exited 0, confirming no change to production code after the run.
