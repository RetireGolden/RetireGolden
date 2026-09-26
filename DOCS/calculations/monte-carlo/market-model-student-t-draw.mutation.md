# Mutation receipt: market-model-student-t-draw

Executed 2026-09-26 against RetireGolden base `8ff951e4` (branch claude/monte-carlo-models), and re-executed 2026-09-26 against RetireGolden base `a78a1c30` (branch `claude/monte-carlo-models`; no pull request is open yet) in `packages/engine`.

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

Re-executed after the review fixes of 2026-09-26 added tests to the evidence file, so the quoted test counts and line numbers match the committed file. The baseline is green (marketModels.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine3/packages/engine

 ❯ src/montecarlo/marketModels.evidence.test.ts (30 tests | 6 failed) 57ms
   ❯ market-model-student-t-draw — Student-t return shock scaled to the configured volatility (8)
     × B1, df 5, Z 1, uniforms 0.5, 0, 0.5: V = 8.805870575472607, m = 0.5836795510996967, shock 7.00415461319636, inflation 0 6ms
     × inflation reads t, not Z: B1 draws with rho −0.2, inflation vol 1.5 and z2 = 0.5 give 0.5597430575050444 1ms
     × B2, an attempt rejected at s <= 0 reads two uniforms and retries: shock 7.00415461319636 after 5 uniforms 0ms
     × B3, the squeeze fails and the exact test rejects, then accepts: shock 7.00415461319636 after 6 uniforms 0ms
     × B4, non-integer df 2.5, Z −2, uniforms 0.5, 0, 0.5: shock −7.486573660049821 0ms
     × one seeded path of 200,000 years at df 5: mean 0, variance 1 and tail share 0.0117248110 within five standard errors 21ms

 Test Files  1 failed (1)
      Tests  6 failed | 24 passed (30)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 6 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/marketModels.evidence.test.ts > market-model-student-t-draw — Student-t return shock scaled to the configured volatility > B1, df 5, Z 1, uniforms 0.5, 0, 0.5: V = 8.805870575472607, m = 0.5836795510996967, shock 7.00415461319636, inflation 0
AssertionError: returnShockPct 9.042324723723786 is not within {"abs":1e-12} of the worksheet's 7.00415461319636: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectShock src/montecarlo/marketModels.evidence.test.ts:839:9
    837|         withinTolerance(actual, expected, example.tolerance),
    838|         `returnShockPct ${actual} is not within ${JSON.stringify(examp…
    839|       ).toBe(true)
       |         ^
    840|     }
    841|
 ❯ src/montecarlo/marketModels.evidence.test.ts:855:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/6]⎯

 FAIL  src/montecarlo/marketModels.evidence.test.ts > market-model-student-t-draw — Student-t return shock scaled to the configured volatility > inflation reads t, not Z: B1 draws with rho −0.2, inflation vol 1.5 and z2 = 0.5 give 0.5597430575050444
AssertionError: returnShockPct 9.042324723723786 is not within {"abs":1e-12} of the worksheet's 7.00415461319636: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectShock src/montecarlo/marketModels.evidence.test.ts:839:9
    837|         withinTolerance(actual, expected, example.tolerance),
    838|         `returnShockPct ${actual} is not within ${JSON.stringify(examp…
    839|       ).toBe(true)
       |         ^
    840|     }
    841|
 ❯ src/montecarlo/marketModels.evidence.test.ts:871:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/6]⎯

 FAIL  src/montecarlo/marketModels.evidence.test.ts > market-model-student-t-draw — Student-t return shock scaled to the configured volatility > B2, an attempt rejected at s <= 0 reads two uniforms and retries: shock 7.00415461319636 after 5 uniforms
AssertionError: returnShockPct 9.042324723723786 is not within {"abs":1e-12} of the worksheet's 7.00415461319636: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectShock src/montecarlo/marketModels.evidence.test.ts:839:9
    837|         withinTolerance(actual, expected, example.tolerance),
    838|         `returnShockPct ${actual} is not within ${JSON.stringify(examp…
    839|       ).toBe(true)
       |         ^
    840|     }
    841|
 ❯ src/montecarlo/marketModels.evidence.test.ts:881:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/6]⎯

 FAIL  src/montecarlo/marketModels.evidence.test.ts > market-model-student-t-draw — Student-t return shock scaled to the configured volatility > B3, the squeeze fails and the exact test rejects, then accepts: shock 7.00415461319636 after 6 uniforms
AssertionError: returnShockPct 9.042324723723786 is not within {"abs":1e-12} of the worksheet's 7.00415461319636: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectShock src/montecarlo/marketModels.evidence.test.ts:839:9
    837|         withinTolerance(actual, expected, example.tolerance),
    838|         `returnShockPct ${actual} is not within ${JSON.stringify(examp…
    839|       ).toBe(true)
       |         ^
    840|     }
    841|
 ❯ src/montecarlo/marketModels.evidence.test.ts:887:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/6]⎯

 FAIL  src/montecarlo/marketModels.evidence.test.ts > market-model-student-t-draw — Student-t return shock scaled to the configured volatility > B4, non-integer df 2.5, Z −2, uniforms 0.5, 0, 0.5: shock −7.486573660049821
AssertionError: returnShockPct -16.740487622430802 is not within {"abs":1e-12} of the worksheet's -7.486573660049821: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectShock src/montecarlo/marketModels.evidence.test.ts:839:9
    837|         withinTolerance(actual, expected, example.tolerance),
    838|         `returnShockPct ${actual} is not within ${JSON.stringify(examp…
    839|       ).toBe(true)
       |         ^
    840|     }
    841|
 ❯ src/montecarlo/marketModels.evidence.test.ts:894:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/6]⎯

 FAIL  src/montecarlo/marketModels.evidence.test.ts > market-model-student-t-draw — Student-t return shock scaled to the configured volatility > one seeded path of 200,000 years at df 5: mean 0, variance 1 and tail share 0.0117248110 within five standard errors
AssertionError: variance 1.6587666779806496: expected 0.6587666779806496 to be less than 0.0317
 ❯ src/montecarlo/marketModels.evidence.test.ts:933:62
    931|       const variance = sumSquares / N - mean * mean
    932|       expect(Math.abs(mean), `mean ${mean}`).toBeLessThan(0.0112)
    933|       expect(Math.abs(variance - 1), `variance ${variance}`).toBeLessT…
       |                                                              ^
    934|       expect(Math.abs(beyondThree / N - 0.011724811003954616), `tail s…
    935|     })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[6/6]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/marketModels.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/marketModels.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
