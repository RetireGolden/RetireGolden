# Mutation receipt: market-model-garch-variance

Executed 2026-09-26 against RetireGolden base `8ff951e4` (branch claude/monte-carlo-models) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/marketModels.ts`

```diff
--- a/packages/engine/src/montecarlo/marketModels.ts
+++ b/packages/engine/src/montecarlo/marketModels.ts
@@ mutation @@
-        variance = omega + alpha * innovation * innovation + beta * variance
+        variance = omega + alpha * (innovation * 100) ** 2 + beta * variance
```

Feeds back the published percent `100 e_t` instead of the innovation `e_t`, the worksheet's first wrong reading: year 2 of the default case then gives 189.82202190473055 rather than 6.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/montecarlo/marketModels.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1 FORCE_COLOR=0`. The `Start at` and `Duration` lines are the only lines removed.

```

 RUN  v5.0.0 C:/rgwt/engine3/packages/engine

 ❯ src/montecarlo/marketModels.evidence.test.ts (28 tests | 4 failed) 51ms
   ❯ market-model-garch-variance — GARCH(1,1) variance recursion with variance targeting (6)
     × defaults (12, 0.1, 0.85), Z1 = 1, 0.5, −2, 0: shocks 12, 6, −23.082460874005616, 0 with inflation 0 4ms
     × the same defaults are what an empty config runs: omega is 0.0144 · 0.05 and v_1 is 0.0144 0ms
     × returnVolPct 100, alpha 0.1, beta 0.8, Z1 = 1, 0.5, −2: variances 1, 1, 0.925 and shocks 100, 50, −192.35384061671346 0ms
     × 2,000 seeded paths of 30 years: every year has the configured variance, mean 0, and squared shocks cluster 6ms

 Test Files  1 failed (1)
      Tests  4 failed | 24 passed (28)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/marketModels.evidence.test.ts > market-model-garch-variance — GARCH(1,1) variance recursion with variance targeting > defaults (12, 0.1, 0.85), Z1 = 1, 0.5, −2, 0: shocks 12, 6, −23.082460874005616, 0 with inflation 0
AssertionError: returnShockPct[1] 189.82202190473055 is not within {"abs":1e-12} of the worksheet's 6: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/marketModels.evidence.test.ts:253:11
    251|           withinTolerance(shock, value, example.tolerance),
    252|           `returnShockPct[${index}] ${shock} is not within ${JSON.stri…
    253|         ).toBe(true)
       |           ^
    254|       })
    255|     }
 ❯ expectShocks src/montecarlo/marketModels.evidence.test.ts:248:16
 ❯ src/montecarlo/marketModels.evidence.test.ts:266:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/4]⎯

 FAIL  src/montecarlo/marketModels.evidence.test.ts > market-model-garch-variance — GARCH(1,1) variance recursion with variance targeting > the same defaults are what an empty config runs: omega is 0.0144 · 0.05 and v_1 is 0.0144
AssertionError: returnShockPct[1] 189.82202190473055 is not within {"abs":1e-12} of the worksheet's 6: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/marketModels.evidence.test.ts:253:11
    251|           withinTolerance(shock, value, example.tolerance),
    252|           `returnShockPct[${index}] ${shock} is not within ${JSON.stri…
    253|         ).toBe(true)
       |           ^
    254|       })
    255|     }
 ❯ expectShocks src/montecarlo/marketModels.evidence.test.ts:248:16
 ❯ src/montecarlo/marketModels.evidence.test.ts:279:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/4]⎯

 FAIL  src/montecarlo/marketModels.evidence.test.ts > market-model-garch-variance — GARCH(1,1) variance recursion with variance targeting > returnVolPct 100, alpha 0.1, beta 0.8, Z1 = 1, 0.5, −2: variances 1, 1, 0.925 and shocks 100, 50, −192.35384061671346
AssertionError: returnShockPct[1] 1581.8501825394212 is not within {"abs":1e-12} of the worksheet's 50: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/marketModels.evidence.test.ts:253:11
    251|           withinTolerance(shock, value, example.tolerance),
    252|           `returnShockPct[${index}] ${shock} is not within ${JSON.stri…
    253|         ).toBe(true)
       |           ^
    254|       })
    255|     }
 ❯ expectShocks src/montecarlo/marketModels.evidence.test.ts:248:16
 ❯ src/montecarlo/marketModels.evidence.test.ts:289:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/4]⎯

 FAIL  src/montecarlo/marketModels.evidence.test.ts > market-model-garch-variance — GARCH(1,1) variance recursion with variance targeting > 2,000 seeded paths of 30 years: every year has the configured variance, mean 0, and squared shocks cluster
AssertionError: mean(r^2) 1.1420190999439862e+80: expected 1.1420190999439862e+80 to be less than 0.07
 ❯ src/montecarlo/marketModels.evidence.test.ts:368:79
    366|       }
    367|       const garch = statistics({ type: 'garch', inflationMeanPct: 2.5 …
    368|       expect(Math.abs(garch.meanSquare - 1), `mean(r^2) ${garch.meanSq…
       |                                                                               ^
    369|       expect(Math.abs(garch.mean), `mean(r) ${garch.mean}`).toBeLessTh…
    370|       expect(garch.clustering, `clustering ${garch.clustering}`).toBeG…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/4]⎯
```

## Revert

The mutated file was restored from a byte copy taken before the edit, and the restored bytes were compared with that copy and found identical, so no production code changed after the run. The evidence file then passes again on the unmutated code.
