# Mutation receipt: market-model-lognormal-draw

Re-executed 2026-09-18 after the second #719 review against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo), and re-executed 2026-09-26 against RetireGolden base `fe6233de` (branch `claude/monte-carlo-models`; no pull request is open yet) in `packages/engine`.

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

Re-executed because this branch added tests to the evidence file, so the test counts and quoted line numbers recorded earlier no longer matched it. The baseline is green (marketModels.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine3/packages/engine

 ❯ src/montecarlo/marketModels.evidence.test.ts (30 tests | 1 failed) 56ms
   ❯ market-model-lognormal-draw — Mean-preserving lognormal return shock (1)
     × zero return vol and inflation 3/0 yields shock 0 and inflation 3% every year 5ms

 Test Files  1 failed (1)
      Tests  1 failed | 29 passed (30)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/marketModels.evidence.test.ts > market-model-lognormal-draw — Mean-preserving lognormal return shock > zero return vol and inflation 3/0 yields shock 0 and inflation 3% every year
AssertionError: expected 100 to be +0 // Object.is equality

- Expected
+ Received

- 0
+ 100

 ❯ src/montecarlo/marketModels.evidence.test.ts:512:62
    510|       })
    511|       const path = seriesOf(model.generatePath(scriptedRng({ normals: …
    512|       for (const shock of path.returnShockPct) expect(shock).toBe(exam…
       |                                                              ^
    513|       for (const inflation of path.inflationPct) expect(inflation).toB…
    514|     })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/marketModels.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/marketModels.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
