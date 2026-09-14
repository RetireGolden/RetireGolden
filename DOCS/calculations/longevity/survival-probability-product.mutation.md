# Mutation receipt: survival-probability-product

Executed 2026-09-14 against RetireGolden base `2dc2011c` (branch claude/b1-p4-cards-longevity) in `packages/engine`.

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

Captured with `NO_COLOR=1`, stdout and stderr together; stdout precedes stderr, so the run summary appears before the failed-test detail. Blank lines and the `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-b1p4long/packages/engine
 ❯ src/montecarlo/survival.evidence.test.ts (12 tests | 6 failed) 8ms
   ❯ survival-probability-product — Conditional survival to a target age: product of hazard-adjusted one-year survivals (2)
     × multiplies p65 and p66 from the SSA male rows: S(67) = 0.963150477964002 2ms
     × returns exactly 1 when the target age is not later than the current age 2ms
   ❯ survival-percentile-age — Survival-percentile planning age: oldest age reached with probability at least pct/100 (3)
     × brackets the threshold: S(66) >= 0.97 and S(67) < 0.97 0ms
   ❯ joint-survival-percentile-age — Joint (either-survives) percentile age on the primary's age clock (4)
     × single-life survival to 69, 70, 71 matches the worksheet within 1e-9 0ms
     × either-alive survival 1 - (1 - S)^2 qualifies at 70 (0.9905 >= 0.99) and fails at 71 (0.9856) 0ms
   ❯ survival-hazard-from-expectancy-multiplier — Hazard power for a remaining-years multiplier, solved by bisection (3)
     × the adjusted expectancy at the solved power reproduces the 17.48 baseline 0ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 6 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/montecarlo/survival.evidence.test.ts > survival-probability-product — Conditional survival to a target age: product of hazard-adjusted one-year survivals > multiplies p65 and p66 from the SSA male rows: S(67) = 0.963150477964002
AssertionError: expected 0.01934765555232154 to be less than or equal to 1e-12
 ❯ src/montecarlo/survival.evidence.test.ts:37:85
     35|     it('multiplies p65 and p66 from the SSA male rows: S(67) = 0.96315…
     36|       const survival = survivalProbabilityTo(currentAge, sex, targetAg…
     37|       expect(Math.abs(survival - (example.expected.survivalProbability…
       |                                                                                     ^
     38|     })
     39|
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/6]⎯
 FAIL  src/montecarlo/survival.evidence.test.ts > survival-probability-product — Conditional survival to a target age: product of hazard-adjusted one-year survivals > returns exactly 1 when the target age is not later than the current age
AssertionError: expected 0.9820705610179296 to be 1 // Object.is equality
- Expected
+ Received
- 1
+ 0.9820705610179296
 ❯ src/montecarlo/survival.evidence.test.ts:42:74
     40|     it('returns exactly 1 when the target age is not later than the cu…
     41|       // Domain endpoint of the claim: an empty product.
     42|       expect(survivalProbabilityTo(currentAge, sex, currentAge, hazard…
       |                                                                          ^
     43|       expect(survivalProbabilityTo(currentAge, sex, currentAge - 1, ha…
     44|     })
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/6]⎯
 FAIL  src/montecarlo/survival.evidence.test.ts > survival-percentile-age — Survival-percentile planning age: oldest age reached with probability at least pct/100 > brackets the threshold: S(66) >= 0.97 and S(67) < 0.97
AssertionError: expected 0.9631504779640019 to be greater than or equal to 0.97
 ❯ src/montecarlo/survival.evidence.test.ts:71:66
     69|     it('brackets the threshold: S(66) >= 0.97 and S(67) < 0.97', () =>…
     70|       // The worksheet's two comparisons, through the product record's…
     71|       expect(survivalProbabilityTo(currentAge, sex, 66, hazard)).toBeG…
       |                                                                  ^
     72|       expect(survivalProbabilityTo(currentAge, sex, 67, hazard)).toBeL…
     73|     })
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/6]⎯
 FAIL  src/montecarlo/survival.evidence.test.ts > joint-survival-percentile-age — Joint (either-survives) percentile age on the primary's age clock > single-life survival to 69, 70, 71 matches the worksheet within 1e-9
AssertionError: expected 0.020885515492135354 to be less than or equal to 1e-9
 ❯ src/montecarlo/survival.evidence.test.ts:119:47
    117|       for (const [age, expected] of Object.entries(single)) {
    118|         const survival = survivalProbabilityTo(primary.age, primary.se…
    119|         expect(Math.abs(survival - expected)).toBeLessThanOrEqual(abs)
       |                                               ^
    120|       }
    121|     })
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/6]⎯
 FAIL  src/montecarlo/survival.evidence.test.ts > joint-survival-percentile-age — Joint (either-survives) percentile age on the primary's age clock > either-alive survival 1 - (1 - S)^2 qualifies at 70 (0.9905 >= 0.99) and fails at 71 (0.9856)
AssertionError: expected 0.0036361608359709585 to be less than or equal to 1e-9
 ❯ src/montecarlo/survival.evidence.test.ts:129:60
    127|       for (const [age, expected] of Object.entries(joint)) {
    128|         const s = survivalProbabilityTo(primary.age, primary.sex, Numb…
    129|         expect(Math.abs(1 - (1 - s) * (1 - s) - expected)).toBeLessTha…
       |                                                            ^
    130|       }
    131|       expect(joint['70']!).toBeGreaterThanOrEqual(pct / 100)
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/6]⎯
 FAIL  src/montecarlo/survival.evidence.test.ts > survival-hazard-from-expectancy-multiplier — Hazard power for a remaining-years multiplier, solved by bisection > the adjusted expectancy at the solved power reproduces the 17.48 baseline
AssertionError: expected 0.982070561010385 to be less than or equal to 0.000001
 ❯ src/montecarlo/survival.evidence.test.ts:182:91
    180|         expectancy += survivalProbabilityTo(age, sex, target, hazard)
    181|       }
    182|       expect(Math.abs(expectancy - (example.expected.adjustedExpectanc…
       |                                                                                           ^
    183|     })
    184|   },
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[6/6]⎯
 Test Files  1 failed (1)
      Tests  6 failed | 6 passed (12)
```

## Revert

`git checkout -- packages/engine/src/montecarlo/survival.ts`, then `git diff --quiet -- packages/engine/src/montecarlo/survival.ts` exited 0, confirming no change to production code after the run.
