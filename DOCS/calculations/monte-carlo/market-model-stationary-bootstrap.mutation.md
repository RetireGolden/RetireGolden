# Mutation receipt: market-model-stationary-bootstrap

Re-executed 2026-09-18 after the second #719 review against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo), and re-executed 2026-09-26 against RetireGolden base `fe6233de` (branch `claude/monte-carlo-models`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/marketModels.ts`

```diff
diff --git a/packages/engine/src/montecarlo/marketModels.ts b/packages/engine/src/montecarlo/marketModels.ts
index 88dabd5b..1030d069 100644
--- a/packages/engine/src/montecarlo/marketModels.ts
+++ b/packages/engine/src/montecarlo/marketModels.ts
@@ -795,7 +795,7 @@ export function createStationaryBootstrapModel(config: StationaryBootstrapModelC
         ? (Object.fromEntries(ASSET_CLASS_IDS.map((id) => [id, new Array<number>(yearCount)])) as Record<AssetClassId, number[]>)
         : null
       let cursor = rng.nextInt(n)
-      let remaining = Math.floor(-Math.log(1 - rng.next()) * meanBlock) || 1
+      let remaining = rng.next() < 1 / meanBlock ? 1 : yearCount
       for (let i = 0; i < yearCount; i++) {
         if (remaining <= 0) {
           cursor = rng.nextInt(n)
```

Treats U as a per-year continuation coin with restart probability 1/L: remaining is yearCount when U >= 1/L, so U = 0.50 continues the 2000 block through 2004 rather than restarting at 1928 after three years (the worksheet's first wrong reading). Year 4 then publishes 2003 (inflation 1.9) rather than 1928 (inflation −1.2).

## Command

```
NO_COLOR=1 FORCE_COLOR=0 npx.cmd vitest run src/montecarlo/marketModels.evidence.test.ts
```

## Captured failing output

Re-executed for D-RECEIPT-DRIFT because its diff was a text substitution that named no line (it is now the git diff of the same substitution); the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (marketModels.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine9/packages/engine

 ❯ src/montecarlo/marketModels.evidence.test.ts (30 tests | 1 failed) 55ms
   ❯ market-model-stationary-bootstrap — Stationary (geometric-block) historical bootstrap (1)
     × five years: inflation 3.4, 1.6, 2.4, −1.2, 0.6 identifying 2000, 2001, 2002, 1928, 1929 5ms

 Test Files  1 failed (1)
      Tests  1 failed | 29 passed (30)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/marketModels.evidence.test.ts > market-model-stationary-bootstrap — Stationary (geometric-block) historical bootstrap > five years: inflation 3.4, 1.6, 2.4, −1.2, 0.6 identifying 2000, 2001, 2002, 1928, 1929
AssertionError: expected 1.9 to be -1.2 // Object.is equality

- Expected
+ Received

- -1.2
+ 1.9

 ❯ src/montecarlo/marketModels.evidence.test.ts:709:42
    707|
    708|       expectedInflation.forEach((value, index) => {
    709|         expect(path.inflationPct[index]).toBe(value)
       |                                          ^
    710|       })
    711|       expectedShocks.forEach((value, index) => {
 ❯ src/montecarlo/marketModels.evidence.test.ts:708:25

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/marketModels.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/marketModels.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
