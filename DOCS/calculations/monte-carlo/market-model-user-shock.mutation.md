# Mutation receipt: market-model-user-shock

Re-executed 2026-09-18 after the second #719 review against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo), and re-executed 2026-09-26 against RetireGolden base `fe6233de` (branch `claude/monte-carlo-models`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/marketModels.ts`

```diff
diff --git a/packages/engine/src/montecarlo/marketModels.ts b/packages/engine/src/montecarlo/marketModels.ts
index 88dabd5b..e02ce7e6 100644
--- a/packages/engine/src/montecarlo/marketModels.ts
+++ b/packages/engine/src/montecarlo/marketModels.ts
@@ -1066,7 +1066,7 @@ export function createUserShockModel(config: UserShockModelConfig): MarketModel
         ? (Object.fromEntries(ASSET_CLASS_IDS.map((id) => [id, new Array<number>(yearCount)])) as Record<AssetClassId, number[]>)
         : null
       for (let i = 0; i < yearCount; i++) {
-        const yearIdx = i + 1
+        const yearIdx = i
         const z1 = rng.nextNormal()
         const z2 = rng.nextNormal()
         if (yearIdx === shockYear) {
```

Treats shockYear as zero-based, so year 2 of a 3-year path is the last slot: [0, 0, -20] rather than [0, -20, 0].

## Command

```
NO_COLOR=1 FORCE_COLOR=0 npx.cmd vitest run src/montecarlo/marketModels.evidence.test.ts
```

## Captured failing output

Re-executed for D-RECEIPT-DRIFT because its diff was a text substitution that named no line (it is now the git diff of the same substitution); the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (marketModels.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine9/packages/engine

 ❯ src/montecarlo/marketModels.evidence.test.ts (30 tests | 1 failed) 57ms
   ❯ market-model-user-shock — One-year additive user shock on a lognormal base (1)
     × years 1 and 3 are 0 and year 2 is −20 5ms

 Test Files  1 failed (1)
      Tests  1 failed | 29 passed (30)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/marketModels.evidence.test.ts > market-model-user-shock — One-year additive user shock on a lognormal base > years 1 and 3 are 0 and year 2 is −20
AssertionError: expected [ +0, +0, -20 ] to deeply equal [ +0, -20, +0 ]

- Expected
+ Received

  [
    0,
-   -20,
    0,
+   -20,
  ]

 ❯ src/montecarlo/marketModels.evidence.test.ts:971:35
    969|         model.generatePath(scriptedRng({ normals: [0, 0, 0, 0, 0, 0] }…
    970|       )
    971|       expect(path.returnShockPct).toEqual(example.expected.returnShock…
       |                                   ^
    972|     })
    973|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/marketModels.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/marketModels.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
