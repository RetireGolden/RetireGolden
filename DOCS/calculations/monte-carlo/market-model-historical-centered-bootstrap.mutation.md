# Mutation receipt: market-model-historical-centered-bootstrap

Re-executed 2026-09-18 after the second #719 review against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo), and re-executed 2026-09-26 against RetireGolden base `fe6233de` (branch `claude/monte-carlo-models`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/marketModels.ts`

```diff
diff --git a/packages/engine/src/montecarlo/marketModels.ts b/packages/engine/src/montecarlo/marketModels.ts
index 88dabd5b..7fb1e5a5 100644
--- a/packages/engine/src/montecarlo/marketModels.ts
+++ b/packages/engine/src/montecarlo/marketModels.ts
@@ -551,7 +551,7 @@ export function createHistoricalModel(config: HistoricalModelConfig): MarketMode
           leftInBlock--
         }
         const sample = HISTORICAL_YEARS[cursor]!
-        returnShockPct[i] = portfolioReturnPct(sample, equityWeightPct) - mean
+        returnShockPct[i] = portfolioReturnPct(sample, equityWeightPct)
         inflationPct[i] = sample.inflationPct
         if (classSeries) {
           // Keyed by class off the same sampled year: the dataset carries US
```

Returns the raw 1928 blend 26.599999999999998 as the centered shock, failing to subtract the dataset mean (the worksheet's third wrong reading). The hunk carries context lines because the changed line also appears in the stationary, empirical and reversed-history models; the mutation changes only createHistoricalModel.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 npx.cmd vitest run src/montecarlo/marketModels.evidence.test.ts
```

## Captured failing output

Re-executed for D-RECEIPT-DRIFT because its diff was a text substitution that named no line (it is now the git diff of the same substitution); the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (marketModels.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/montecarlo/marketModels.evidence.test.ts (30 tests | 1 failed) 56ms
   ❯ market-model-historical-centered-bootstrap — Centered historical bootstrap shock (1)
     × 1928 at 60% equity is shock 17.662708333333327 and inflation −1.2% 6ms

 Test Files  1 failed (1)
      Tests  1 failed | 29 passed (30)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/marketModels.evidence.test.ts > market-model-historical-centered-bootstrap — Centered historical bootstrap shock > 1928 at 60% equity is shock 17.662708333333327 and inflation −1.2%
AssertionError: returnShockPct 26.599999999999998 is not within {"abs":1e-12} of the worksheet's 17.662708333333327: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/marketModels.evidence.test.ts:455:9
    453|         withinTolerance(shock, expectedShock, example.tolerance),
    454|         `returnShockPct ${shock} is not within ${JSON.stringify(exampl…
    455|       ).toBe(true)
       |         ^
    456|       expect(
    457|         withinTolerance(inflation, expectedInflation, example.toleranc…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/marketModels.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/marketModels.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
