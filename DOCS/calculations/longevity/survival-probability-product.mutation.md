# Mutation receipt: survival-probability-product

Executed 2026-09-14 against RetireGolden base `2dc2011c` (branch claude/b1-p4-cards-longevity), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/survival.ts`

```diff
@@ -38,7 +38,7 @@ export function survivalProbabilityTo(
   const from = Math.floor(Math.max(currentAge, 0))
   const to = Math.floor(targetAge)
   let s = 1
-  for (let age = from; age < to; age++) {
+  for (let age = from; age <= to; age++) {
     s *= annualSurvival(age, sex, hazard)
     if (s <= 0) return 0
   }
```

This multiplies through the target age as well, the worksheet's first wrong reading (one period too many): S(67) becomes p65 p66 p67 = 0.943802822411680, a 0.0193 miss against 1e-12, and the domain endpoint fails because a target equal to the current age now consumes one factor (0.98207 instead of 1). The percentile, joint and hazard blocks in the same file fail where they read `survivalProbabilityTo` for their intermediate checks; the three production percentile and hazard functions do not call it, so their own assertions still pass.

## Command

```
npx vitest run src/montecarlo/survival.evidence.test.ts
```

## Captured failing output

Re-executed for D-RECEIPT-DRIFT because the test lines it quoted no longer matched the current test file; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (survival.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine9/packages/engine

 ❯ src/montecarlo/survival.evidence.test.ts (12 tests | 6 failed) 9ms
   ❯ survival-probability-product — Conditional survival to a target age: product of hazard-adjusted one-year survivals (2)
     × multiplies p65 and p66 from the SSA male rows: S(67) = 0.963150477964002 4ms
     × returns exactly 1 when the target age is not later than the current age 1ms
   ❯ survival-percentile-age — Survival-percentile planning age: oldest age reached with probability at least pct/100 (3)
     × brackets the threshold: S(66) >= 0.97 and S(67) < 0.97 0ms
   ❯ joint-survival-percentile-age — Joint (either-survives) percentile age on the primary's age clock (4)
     × single-life survival to 69, 70, 71 matches the worksheet within 1e-9 0ms
     × either-alive survival 1 - (1 - S)^2 qualifies at 70 (0.9905 >= 0.99) and fails at 71 (0.9856) 0ms
   ❯ survival-hazard-from-expectancy-multiplier — Hazard power for a remaining-years multiplier, solved by bisection (3)
     × the adjusted expectancy at the solved power reproduces the 17.48 baseline 1ms

 Test Files  1 failed (1)
      Tests  6 failed | 6 passed (12)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 6 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/survival.evidence.test.ts > survival-probability-product — Conditional survival to a target age: product of hazard-adjusted one-year survivals > multiplies p65 and p66 from the SSA male rows: S(67) = 0.963150477964002
AssertionError: survivalProbability 0.9438028224116805 is not within {"abs":1e-12} of the worksheet's 0.963150477964002: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/survival.evidence.test.ts:36:9
     34|         withinTolerance(survival, expected, example.tolerance),
     35|         `survivalProbability ${survival} is not within ${JSON.stringif…
     36|       ).toBe(true)
       |         ^
     37|     })
     38|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/6]⎯

 FAIL  src/montecarlo/survival.evidence.test.ts > survival-probability-product — Conditional survival to a target age: product of hazard-adjusted one-year survivals > returns exactly 1 when the target age is not later than the current age
AssertionError: expected 0.9820705610179296 to be 1 // Object.is equality

- Expected
+ Received

- 1
+ 0.9820705610179296

 ❯ src/montecarlo/survival.evidence.test.ts:41:74
     39|     it('returns exactly 1 when the target age is not later than the cu…
     40|       // Domain endpoint of the claim: an empty product.
     41|       expect(survivalProbabilityTo(currentAge, sex, currentAge, hazard…
       |                                                                          ^
     42|       expect(survivalProbabilityTo(currentAge, sex, currentAge - 1, ha…
     43|     })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/6]⎯

 FAIL  src/montecarlo/survival.evidence.test.ts > survival-percentile-age — Survival-percentile planning age: oldest age reached with probability at least pct/100 > brackets the threshold: S(66) >= 0.97 and S(67) < 0.97
AssertionError: expected 0.9631504779640019 to be greater than or equal to 0.97
 ❯ src/montecarlo/survival.evidence.test.ts:70:66
     68|     it('brackets the threshold: S(66) >= 0.97 and S(67) < 0.97', () =>…
     69|       // The worksheet's two comparisons, through the product record's…
     70|       expect(survivalProbabilityTo(currentAge, sex, 66, hazard)).toBeG…
       |                                                                  ^
     71|       expect(survivalProbabilityTo(currentAge, sex, 67, hazard)).toBeL…
     72|     })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/6]⎯

 FAIL  src/montecarlo/survival.evidence.test.ts > joint-survival-percentile-age — Joint (either-survives) percentile age on the primary's age clock > single-life survival to 69, 70, 71 matches the worksheet within 1e-9
AssertionError: single-life survival to 69 0.9025074165078647 is not within {"abs":1e-9} of the worksheet's 0.923392932: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/survival.evidence.test.ts:120:11
    118|           withinTolerance(survival, expected, example.tolerance),
    119|           `single-life survival to ${age} ${survival} is not within ${…
    120|         ).toBe(true)
       |           ^
    121|       }
    122|     })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/6]⎯

 FAIL  src/montecarlo/survival.evidence.test.ts > joint-survival-percentile-age — Joint (either-survives) percentile age on the primary's age clock > either-alive survival 1 - (1 - S)^2 qualifies at 70 (0.9905 >= 0.99) and fails at 71 (0.9856)
AssertionError: either-alive survival to 69 0.990495196164029 is not within {"abs":1e-9} of the worksheet's 0.994131357: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/survival.evidence.test.ts:134:11
    132|           withinTolerance(eitherAlive, expected, example.tolerance),
    133|           `either-alive survival to ${age} ${eitherAlive} is not withi…
    134|         ).toBe(true)
       |           ^
    135|       }
    136|       expect(joint['70']!).toBeGreaterThanOrEqual(pct / 100)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/6]⎯

 FAIL  src/montecarlo/survival.evidence.test.ts > survival-hazard-from-expectancy-multiplier — Hazard power for a remaining-years multiplier, solved by bisection > the adjusted expectancy at the solved power reproduces the 17.48 baseline
AssertionError: adjustedExpectancyYears 16.497929438989615 is not within {"abs":0.000001} of the worksheet's 17.48: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/survival.evidence.test.ts:194:9
    192|         withinTolerance(expectancy, expected, example.tolerance),
    193|         `adjustedExpectancyYears ${expectancy} is not within ${JSON.st…
    194|       ).toBe(true)
       |         ^
    195|     })
    196|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[6/6]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/survival.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/survival.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
