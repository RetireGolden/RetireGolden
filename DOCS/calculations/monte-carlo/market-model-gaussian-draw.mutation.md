# Mutation receipt: market-model-gaussian-draw

Re-executed 2026-09-18 after the second #719 review against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo), and re-executed 2026-09-26 against RetireGolden base `fe6233de` (branch `claude/monte-carlo-models`; no pull request is open yet) in `packages/engine`.

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

Re-executed because this branch added tests to the evidence file, so the test counts and quoted line numbers recorded earlier no longer matched it. The baseline is green (marketModels.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine3/packages/engine

 ❯ src/montecarlo/marketModels.evidence.test.ts (30 tests | 1 failed) 59ms
   ❯ market-model-gaussian-draw — Additive Gaussian return shock (1)
     × volatility 12 times Z = −2 is shock −24 6ms

 Test Files  1 failed (1)
      Tests  1 failed | 29 passed (30)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/marketModels.evidence.test.ts > market-model-gaussian-draw — Additive Gaussian return shock > volatility 12 times Z = −2 is shock −24
AssertionError: expected -0.24 to be -24 // Object.is equality

- Expected
+ Received

- -24
+ -0.24

 ❯ src/montecarlo/marketModels.evidence.test.ts:416:38
    414|       })
    415|       const path = seriesOf(model.generatePath(scriptedRng({ normals: …
    416|       expect(path.returnShockPct[0]).toBe(example.expected.returnShock…
       |                                      ^
    417|     })
    418|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/marketModels.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/marketModels.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
