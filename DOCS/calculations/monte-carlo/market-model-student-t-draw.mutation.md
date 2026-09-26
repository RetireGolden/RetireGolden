# Mutation receipt: market-model-student-t-draw

Executed 2026-09-26 against RetireGolden base `8ff951e4` (branch claude/monte-carlo-models) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/marketModels.ts`

```diff
--- a/packages/engine/src/montecarlo/marketModels.ts
+++ b/packages/engine/src/montecarlo/marketModels.ts
@@ mutation @@
-        const m = Math.sqrt((df - 2) / sampleChiSquare(rng, df))
+        const m = Math.sqrt(df / sampleChiSquare(rng, df))
```

Uses `df / V` in place of `(df - 2) / V`, the worksheet's first wrong reading (the unscaled t): case B1 then gives 9.042324723723786 rather than 7.00415461319636, and the seeded variance leaves its band.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/montecarlo/marketModels.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1 FORCE_COLOR=0`. The `Start at` and `Duration` lines are the only lines removed.

```

 RUN  v5.0.0 C:/rgwt/engine3/packages/engine

 ❯ src/montecarlo/marketModels.evidence.test.ts (28 tests | 5 failed) 57ms
   ❯ market-model-student-t-draw — Student-t return shock scaled to the configured volatility (7)
     × B1, df 5, Z 1, uniforms 0.5, 0, 0.5: V = 8.805870575472607, m = 0.5836795510996967, shock 7.00415461319636, inflation 0 5ms
     × B2, an attempt rejected at s <= 0 reads two uniforms and retries: shock 7.00415461319636 after 5 uniforms 0ms
     × B3, the squeeze fails and the exact test rejects, then accepts: shock 7.00415461319636 after 6 uniforms 0ms
     × B4, non-integer df 2.5, Z −2, uniforms 0.5, 0, 0.5: shock −7.486573660049821 0ms
     × one seeded path of 200,000 years at df 5: mean 0, variance 1 and tail share 0.0117248110 within five standard errors 21ms

 Test Files  1 failed (1)
      Tests  5 failed | 23 passed (28)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 5 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/marketModels.evidence.test.ts > market-model-student-t-draw — Student-t return shock scaled to the configured volatility > B1, df 5, Z 1, uniforms 0.5, 0, 0.5: V = 8.805870575472607, m = 0.5836795510996967, shock 7.00415461319636, inflation 0
AssertionError: returnShockPct 9.042324723723786 is not within {"abs":1e-12} of the worksheet's 7.00415461319636: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectShock src/montecarlo/marketModels.evidence.test.ts:822:9
    820|         withinTolerance(actual, expected, example.tolerance),
    821|         `returnShockPct ${actual} is not within ${JSON.stringify(examp…
    822|       ).toBe(true)
       |         ^
    823|     }
    824|
 ❯ src/montecarlo/marketModels.evidence.test.ts:838:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/5]⎯

 FAIL  src/montecarlo/marketModels.evidence.test.ts > market-model-student-t-draw — Student-t return shock scaled to the configured volatility > B2, an attempt rejected at s <= 0 reads two uniforms and retries: shock 7.00415461319636 after 5 uniforms
AssertionError: returnShockPct 9.042324723723786 is not within {"abs":1e-12} of the worksheet's 7.00415461319636: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectShock src/montecarlo/marketModels.evidence.test.ts:822:9
    820|         withinTolerance(actual, expected, example.tolerance),
    821|         `returnShockPct ${actual} is not within ${JSON.stringify(examp…
    822|       ).toBe(true)
       |         ^
    823|     }
    824|
 ❯ src/montecarlo/marketModels.evidence.test.ts:847:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/5]⎯

 FAIL  src/montecarlo/marketModels.evidence.test.ts > market-model-student-t-draw — Student-t return shock scaled to the configured volatility > B3, the squeeze fails and the exact test rejects, then accepts: shock 7.00415461319636 after 6 uniforms
AssertionError: returnShockPct 9.042324723723786 is not within {"abs":1e-12} of the worksheet's 7.00415461319636: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectShock src/montecarlo/marketModels.evidence.test.ts:822:9
    820|         withinTolerance(actual, expected, example.tolerance),
    821|         `returnShockPct ${actual} is not within ${JSON.stringify(examp…
    822|       ).toBe(true)
       |         ^
    823|     }
    824|
 ❯ src/montecarlo/marketModels.evidence.test.ts:853:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/5]⎯

 FAIL  src/montecarlo/marketModels.evidence.test.ts > market-model-student-t-draw — Student-t return shock scaled to the configured volatility > B4, non-integer df 2.5, Z −2, uniforms 0.5, 0, 0.5: shock −7.486573660049821
AssertionError: returnShockPct -16.740487622430802 is not within {"abs":1e-12} of the worksheet's -7.486573660049821: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectShock src/montecarlo/marketModels.evidence.test.ts:822:9
    820|         withinTolerance(actual, expected, example.tolerance),
    821|         `returnShockPct ${actual} is not within ${JSON.stringify(examp…
    822|       ).toBe(true)
       |         ^
    823|     }
    824|
 ❯ src/montecarlo/marketModels.evidence.test.ts:860:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/5]⎯

 FAIL  src/montecarlo/marketModels.evidence.test.ts > market-model-student-t-draw — Student-t return shock scaled to the configured volatility > one seeded path of 200,000 years at df 5: mean 0, variance 1 and tail share 0.0117248110 within five standard errors
AssertionError: variance 1.6587666779806496: expected 0.6587666779806496 to be less than 0.0317
 ❯ src/montecarlo/marketModels.evidence.test.ts:899:62
    897|       const variance = sumSquares / N - mean * mean
    898|       expect(Math.abs(mean), `mean ${mean}`).toBeLessThan(0.0112)
    899|       expect(Math.abs(variance - 1), `variance ${variance}`).toBeLessT…
       |                                                              ^
    900|       expect(Math.abs(beyondThree / N - 0.011724811003954616), `tail s…
    901|     })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/5]⎯
```

## Revert

The mutated file was restored from a byte copy taken before the edit, and the restored bytes were compared with that copy and found identical, so no production code changed after the run. The evidence file then passes again on the unmutated code.
