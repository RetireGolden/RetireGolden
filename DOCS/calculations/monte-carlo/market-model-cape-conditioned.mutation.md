# Mutation receipt: market-model-cape-conditioned

Re-executed 2026-09-18 after the #719 review against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/marketModels.ts`

```diff
--- a/packages/engine/src/montecarlo/marketModels.ts
+++ b/packages/engine/src/montecarlo/marketModels.ts
@@ mutation @@
-const baseMuAdj = Math.max(-4, Math.min(2, -(startCape - 20) * sens)) // pp adjustment
+const baseMuAdj = Math.max(-4, Math.min(2, (startCape - 20) * sens)) // pp adjustment
```

Raises returns at high CAPE instead of lowering them, the worksheet's first wrong reading (+0.75 rather than -0.75).

## Command

```
NO_COLOR=1 FORCE_COLOR=0 npx.cmd vitest run src/montecarlo/marketModels.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1 FORCE_COLOR=0`. The `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-s3/packages/engine

 ❯ src/montecarlo/marketModels.evidence.test.ts (16 tests | 1 failed) 9ms
   ❯ market-model-cape-conditioned — CAPE-conditioned shift of a mean-preserving lognormal shock (1)
     × CAPE 25 at sensitivity 0.15 and zero vol shifts the shock by −0.75 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 15 passed (16)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/marketModels.evidence.test.ts > market-model-cape-conditioned — CAPE-conditioned shift of a mean-preserving lognormal shock > CAPE 25 at sensitivity 0.15 and zero vol shifts the shock by −0.75
AssertionError: returnShockPct 0.75 is not within {"abs":1e-12} of the worksheet's -0.75: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/marketModels.evidence.test.ts:127:9
    125|         withinTolerance(shock, expected, example.tolerance),
    126|         `returnShockPct ${shock} is not within ${JSON.stringify(exampl…
    127|       ).toBe(true)
       |         ^
    128|     })
    129|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

`git checkout -- packages/engine/src/montecarlo/marketModels.ts`, then `git diff --quiet -- packages/engine/src/montecarlo/marketModels.ts` exited 0, confirming no change to production code after the run.
