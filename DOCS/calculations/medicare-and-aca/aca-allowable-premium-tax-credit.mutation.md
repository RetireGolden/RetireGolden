# Mutation receipt: aca-allowable-premium-tax-credit

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eight` at base `989fc81b`, and re-executed 2026-09-22 against RetireGolden base `a046c8f0` (branch `claude/b1-p4-cards-eight`, pull request #728) in `packages/engine`.

## Mutation applied to `packages/engine/src/tax/aca.ts`

```diff
@@ -205,7 +205,7 @@ export function acaEconomicPremiumByMonth(
     const enrollment = Math.max(0, enrollmentPremiums[month] ?? 0)
     const benchmark = Math.max(0, slcspBenchmarkPremiums[month] ?? 0)
     if (enrollment <= 0 || benchmark <= 0) continue
-    modeledAllowablePtc += Math.min(enrollment, Math.max(0, benchmark - expectedContribution / 12))
+    modeledAllowablePtc += Math.min(enrollment, Math.max(0, enrollment - expectedContribution / 12))
   }
   const economicNetPremium = grossEnrollmentPremium - modeledAllowablePtc
   return {
```

This subtracts the expected contribution from the enrollment premium rather than the SLCSP benchmark, publishing $7,208.20 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/tax/aca.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #728: the branch was renamed for the pull request and two fixtures and one mutation changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (aca.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/tax/aca.evidence.test.ts (13 tests | 6 failed) 8ms
   ❯ aca-400-percent-cliff — ACA 400% FPL cliff (3)
     × allows the credit at exactly 400% of the poverty line 4ms
   ❯ aca-allowable-premium-tax-credit — ACA modeled allowable premium tax credit (3)
     × credits the 12,000 benchmark less the 2,791.80 contribution, under the 10,000 enrollment cap 1ms
     × caps the credit at the enrollment premium when the benchmark is dearer than the plan bought 0ms
     × floors the credit at zero when the contribution exceeds the benchmark 0ms
   ❯ aca-economic-net-premium — ACA economic net premium (2)
     × bears 791.80 of the 10,000 gross premium after a 9,208.20 credit 0ms
     × never falls below zero, because each month's credit is capped at that month's premium 0ms

 Test Files  1 failed (1)
      Tests  6 failed | 7 passed (13)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 6 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/tax/aca.evidence.test.ts > aca-400-percent-cliff — ACA 400% FPL cliff > allows the credit at exactly 400% of the poverty line
AssertionError: modeledAllowablePtc 1573.840000000001 is not within {"abs":0.005} of the worksheet's 3573.84: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/tax/aca.evidence.test.ts:28:5
     26|     withinTolerance(actual, expected, tolerance),
     27|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     28|   ).toBe(true)
       |     ^
     29| }
     30|
 ❯ src/tax/aca.evidence.test.ts:76:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/6]⎯

 FAIL  src/tax/aca.evidence.test.ts > aca-allowable-premium-tax-credit — ACA modeled allowable premium tax credit > credits the 12,000 benchmark less the 2,791.80 contribution, under the 10,000 enrollment cap
AssertionError: modeledAllowablePtc 7208.200000000001 is not within {"abs":0.005} of the worksheet's 9208.2: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/tax/aca.evidence.test.ts:28:5
     26|     withinTolerance(actual, expected, tolerance),
     27|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     28|   ).toBe(true)
       |     ^
     29| }
     30|
 ❯ src/tax/aca.evidence.test.ts:207:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/6]⎯

 FAIL  src/tax/aca.evidence.test.ts > aca-allowable-premium-tax-credit — ACA modeled allowable premium tax credit > caps the credit at the enrollment premium when the benchmark is dearer than the plan bought
AssertionError: modeledAllowablePtc 0 is not within {"abs":0.005} of the worksheet's 2000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/tax/aca.evidence.test.ts:28:5
     26|     withinTolerance(actual, expected, tolerance),
     27|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     28|   ).toBe(true)
       |     ^
     29| }
     30|
 ❯ src/tax/aca.evidence.test.ts:225:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/6]⎯

 FAIL  src/tax/aca.evidence.test.ts > aca-allowable-premium-tax-credit — ACA modeled allowable premium tax credit > floors the credit at zero when the contribution exceeds the benchmark
AssertionError: expected 1633.5999999999985 to be +0 // Object.is equality

- Expected
+ Received

- 0
+ 1633.5999999999985

 ❯ src/tax/aca.evidence.test.ts:236:40
    234|         byMonth(4_000),
    235|       )
    236|       expect(none.modeledAllowablePtc).toBe(0)
       |                                        ^
    237|     })
    238|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/6]⎯

 FAIL  src/tax/aca.evidence.test.ts > aca-economic-net-premium — ACA economic net premium > bears 791.80 of the 10,000 gross premium after a 9,208.20 credit
AssertionError: modeledAllowablePtc 7208.200000000001 is not within {"abs":0.005} of the worksheet's 9208.2: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/tax/aca.evidence.test.ts:28:5
     26|     withinTolerance(actual, expected, tolerance),
     27|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     28|   ).toBe(true)
       |     ^
     29| }
     30|
 ❯ src/tax/aca.evidence.test.ts:270:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/6]⎯

 FAIL  src/tax/aca.evidence.test.ts > aca-economic-net-premium — ACA economic net premium > never falls below zero, because each month's credit is capped at that month's premium
AssertionError: expected 1200 to be +0 // Object.is equality

- Expected
+ Received

- 0
+ 1200

 ❯ src/tax/aca.evidence.test.ts:294:41
    292|         byMonth(inputs.applicableSlcspPremium!),
    293|       )
    294|       expect(result.economicNetPremium).toBe(0)
       |                                         ^
    295|     })
    296|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[6/6]⎯
```

## Revert

The original bytes of `packages/engine/src/tax/aca.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/tax/aca.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
