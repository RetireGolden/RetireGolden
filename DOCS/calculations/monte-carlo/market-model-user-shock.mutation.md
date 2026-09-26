# Mutation receipt: market-model-user-shock

Re-executed 2026-09-18 after the second #719 review against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo), and re-executed 2026-09-26 against RetireGolden base `fe6233de` (branch `claude/monte-carlo-models`; no pull request is open yet) in `packages/engine`.

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

Re-executed because this branch added tests to the evidence file, so the test counts and quoted line numbers recorded earlier no longer matched it. The baseline is green (marketModels.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine3/packages/engine

 ❯ src/montecarlo/marketModels.evidence.test.ts (30 tests | 1 failed) 56ms
   ❯ market-model-user-shock — One-year additive user shock on a lognormal base (1)
     × years 1 and 3 are 0 and year 2 is −20 4ms

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
