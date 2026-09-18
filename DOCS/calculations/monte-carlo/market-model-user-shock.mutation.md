# Mutation receipt: market-model-user-shock

Re-executed 2026-09-18 after the #719 review against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/marketModels.ts`

```diff
--- a/packages/engine/src/montecarlo/marketModels.ts
+++ b/packages/engine/src/montecarlo/marketModels.ts
@@ mutation @@
-const yearIdx = i + 1
+const yearIdx = i
```

Treats shockYear as zero-based, so year 2 of a 3-year path is the last slot: [0, 0, -20] rather than [0, -20, 0].

## Command

```
NO_COLOR=1 FORCE_COLOR=0 npx.cmd vitest run src/montecarlo/marketModels.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1 FORCE_COLOR=0`. The `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-s3/packages/engine

 ❯ src/montecarlo/marketModels.evidence.test.ts (16 tests | 1 failed) 9ms
   ❯ market-model-user-shock — One-year additive user shock on a lognormal base (1)
     × years 1 and 3 are 0 and year 2 is −20 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 15 passed (16)


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

 ❯ src/montecarlo/marketModels.evidence.test.ts:620:35
    618|         model.generatePath(scriptedRng({ normals: [0, 0, 0, 0, 0, 0] }…
    619|       )
    620|       expect(path.returnShockPct).toEqual(example.expected.returnShock…
       |                                   ^
    621|     })
    622|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

`git checkout -- packages/engine/src/montecarlo/marketModels.ts`, then `git diff --quiet -- packages/engine/src/montecarlo/marketModels.ts` exited 0, confirming no change to production code after the run.
