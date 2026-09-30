# Mutation receipt: market-model-cape-conditioned

Re-executed 2026-09-18 after the second #719 review against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo), and re-executed 2026-09-26 against RetireGolden base `fe6233de` (branch `claude/monte-carlo-models`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/marketModels.ts`

```diff
diff --git a/packages/engine/src/montecarlo/marketModels.ts b/packages/engine/src/montecarlo/marketModels.ts
index 88dabd5b..ceff1a81 100644
--- a/packages/engine/src/montecarlo/marketModels.ts
+++ b/packages/engine/src/montecarlo/marketModels.ts
@@ -725,7 +725,7 @@ export function createRegimeSwitchModel(config: RegimeSwitchModelConfig): Market
 export function createCapeConditionedModel(config: CapeConditionedModelConfig): MarketModel {
   const startCape = config.startingCape ?? 25
   const sens = config.capeSensitivity ?? 0.15
-  const baseMuAdj = Math.max(-4, Math.min(2, -(startCape - 20) * sens)) // pp adjustment
+  const baseMuAdj = Math.max(-4, Math.min(2, (startCape - 20) * sens)) // pp adjustment
   const sigma = returnVolatility('CAPE-conditioned returnVolPct', config.returnVolPct) / 100
   const inflMean = config.inflationMeanPct
   const inflVol = volatilityInput('CAPE-conditioned inflationVolPct', config.inflationVolPct, 1.5)
```

Raises returns at high CAPE instead of lowering them, the worksheet's first wrong reading (+0.75 rather than -0.75).

## Command

```
NO_COLOR=1 FORCE_COLOR=0 npx.cmd vitest run src/montecarlo/marketModels.evidence.test.ts
```

## Captured failing output

Re-executed for D-RECEIPT-DRIFT because its diff was a text substitution that named no line (it is now the git diff of the same substitution); the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (marketModels.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/montecarlo/marketModels.evidence.test.ts (30 tests | 1 failed) 56ms
   ❯ market-model-cape-conditioned — CAPE-conditioned shift of a mean-preserving lognormal shock (1)
     × CAPE 25 at sensitivity 0.15 and zero vol shifts the shock by −0.75 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 29 passed (30)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/marketModels.evidence.test.ts > market-model-cape-conditioned — CAPE-conditioned shift of a mean-preserving lognormal shock > CAPE 25 at sensitivity 0.15 and zero vol shifts the shock by −0.75
AssertionError: returnShockPct 0.75 is not within {"abs":1e-12} of the worksheet's -0.75: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/marketModels.evidence.test.ts:128:9
    126|         withinTolerance(shock, expected, example.tolerance),
    127|         `returnShockPct ${shock} is not within ${JSON.stringify(exampl…
    128|       ).toBe(true)
       |         ^
    129|     })
    130|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/marketModels.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/marketModels.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
