# Mutation receipt: market-model-ar1-shock

Re-executed 2026-09-18 after the second #719 review against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo), and re-executed 2026-09-26 against RetireGolden base `fe6233de` (branch `claude/monte-carlo-models`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/marketModels.ts`

```diff
--- a/packages/engine/src/montecarlo/marketModels.ts
+++ b/packages/engine/src/montecarlo/marketModels.ts
@@ mutation @@
-const shock = phi * prevShock + sigma * eps
+const shock = (1 - phi) * prevShock + sigma * eps
```

Uses 1-phi as persistence, the worksheet's first wrong reading: after a 10-point shock the next year is 8 rather than 2.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 npx.cmd vitest run src/montecarlo/marketModels.evidence.test.ts
```

## Captured failing output

Re-executed because this branch added tests to the evidence file, so the test counts and quoted line numbers recorded earlier no longer matched it. The baseline is green (marketModels.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine3/packages/engine

 ❯ src/montecarlo/marketModels.evidence.test.ts (30 tests | 1 failed) 56ms
   ❯ market-model-ar1-shock — AR(1) mean-reverting return shock (1)
     × after a 10-point shock, two zero-innovation years are 2 then 0.4 5ms

 Test Files  1 failed (1)
      Tests  1 failed | 29 passed (30)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/marketModels.evidence.test.ts > market-model-ar1-shock — AR(1) mean-reverting return shock > after a 10-point shock, two zero-innovation years are 2 then 0.4
AssertionError: nextShocksPct[0] 8.000000000000002 is not within {"abs":1e-12} of the worksheet's 2: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/marketModels.evidence.test.ts:95:11
     93|           withinTolerance(shock, value, example.tolerance),
     94|           `nextShocksPct[${index}] ${shock} is not within ${JSON.strin…
     95|         ).toBe(true)
       |           ^
     96|       })
     97|     })
 ❯ src/montecarlo/marketModels.evidence.test.ts:90:16

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/marketModels.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/marketModels.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
