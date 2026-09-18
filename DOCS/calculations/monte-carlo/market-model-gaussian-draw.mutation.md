# Mutation receipt: market-model-gaussian-draw

Re-executed 2026-09-18 after the #719 review against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/marketModels.ts`

```diff
--- a/packages/engine/src/montecarlo/marketModels.ts
+++ b/packages/engine/src/montecarlo/marketModels.ts
@@ mutation @@
-returnShockPct[i] = sigma * z1 * 100   // additive normal, centered
+returnShockPct[i] = sigma * z1         // additive normal, centered
```

Drops the ×100 that converts a decimal shock to percentage points, so Z=-2 at 12 vol yields -0.24 rather than -24 (the worksheet's first wrong reading).

## Command

```
NO_COLOR=1 FORCE_COLOR=0 npx.cmd vitest run src/montecarlo/marketModels.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1 FORCE_COLOR=0`. The `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-s3/packages/engine

 ❯ src/montecarlo/marketModels.evidence.test.ts (16 tests | 1 failed) 9ms
   ❯ market-model-gaussian-draw — Additive Gaussian return shock (1)
     × volatility 12 times Z = −2 is shock −24 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 15 passed (16)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/marketModels.evidence.test.ts > market-model-gaussian-draw — Additive Gaussian return shock > volatility 12 times Z = −2 is shock −24
AssertionError: expected -0.24 to be -24 // Object.is equality

- Expected
+ Received

- -24
+ -0.24

 ❯ src/montecarlo/marketModels.evidence.test.ts:293:38
    291|       })
    292|       const path = seriesOf(model.generatePath(scriptedRng({ normals: …
    293|       expect(path.returnShockPct[0]).toBe(example.expected.returnShock…
       |                                      ^
    294|     })
    295|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

`git checkout -- packages/engine/src/montecarlo/marketModels.ts`, then `git diff --quiet -- packages/engine/src/montecarlo/marketModels.ts` exited 0, confirming no change to production code after the run.
