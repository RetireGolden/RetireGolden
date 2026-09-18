# Mutation receipt: market-model-inflation-regime

Re-executed 2026-09-18 after the #719 review against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/marketModels.ts`

```diff
--- a/packages/engine/src/montecarlo/marketModels.ts
+++ b/packages/engine/src/montecarlo/marketModels.ts
@@ mutation @@
-if (rng.next() < (high ? 0.7 : pHigh)) high = !high
+if (rng.next() >= (high ? 0.7 : pHigh)) high = !high
```

Reverses the Bernoulli comparison, so U=0.10 does not enter the high regime and inflation stays 3% rather than 8%.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 npx.cmd vitest run src/montecarlo/marketModels.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1 FORCE_COLOR=0`. The `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-s3/packages/engine

 ❯ src/montecarlo/marketModels.evidence.test.ts (16 tests | 1 failed) 9ms
   ❯ market-model-inflation-regime — Bernoulli high-inflation regime mix (1)
     × U = 0.10 < 0.20 selects the high regime at 8% with zero innovation 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 15 passed (16)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/marketModels.evidence.test.ts > market-model-inflation-regime — Bernoulli high-inflation regime mix > U = 0.10 < 0.20 selects the high regime at 8% with zero innovation
AssertionError: expected 3 to be 8 // Object.is equality

- Expected
+ Received

- 8
+ 3

 ❯ src/montecarlo/marketModels.evidence.test.ts:364:36
    362|         model.generatePath(scriptedRng({ uniforms: [example.inputs.reg…
    363|       )
    364|       expect(path.inflationPct[0]).toBe(example.expected.inflationPct)
       |                                    ^
    365|     })
    366|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

`git checkout -- packages/engine/src/montecarlo/marketModels.ts`, then `git diff --quiet -- packages/engine/src/montecarlo/marketModels.ts` exited 0, confirming no change to production code after the run.
