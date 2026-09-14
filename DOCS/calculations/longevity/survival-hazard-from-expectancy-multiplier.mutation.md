# Mutation receipt: survival-hazard-from-expectancy-multiplier

Executed 2026-09-14 against RetireGolden base `2dc2011c` (branch claude/b1-p4-cards-longevity) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/survival.ts`

```diff
@@ -109,7 +109,7 @@ export function jointSurvivalPercentileAge(
 function expectancyUnderHazard(age: number, sex: Sex, hazard: number): number {
   const from = Math.floor(Math.max(age, 0))
   let s = 1
-  let e = 0.5
+  let e = 0
   for (let a = from; a <= MAX_AGE; a++) {
     s *= annualSurvival(a, sex, hazard)
     e += s
```

This drops the half-year convention from the solver's expectancy: the bisection then solves sum S(t) = 17.48 instead of 0.5 + sum S(t) = 17.48, which needs a healthier curve, and lands at h = 0.9363, a 0.0637 miss against the 1e-6 tolerance. The adjusted expectancy recomputed with the convention at that power is 17.98, a 0.5 miss. The worksheet says its two named wrong readings both pass the identity case, so the mutation targets the convention the identity relies on instead.

## Command

```
npx vitest run src/montecarlo/survival.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1`, stdout and stderr together; stdout precedes stderr, so the run summary appears before the failed-test detail. Blank lines and the `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-b1p4long/packages/engine
 ❯ src/montecarlo/survival.evidence.test.ts (12 tests | 2 failed) 5ms
   ❯ survival-hazard-from-expectancy-multiplier — Hazard power for a remaining-years multiplier, solved by bisection (3)
     × the identity multiplier m = 1 solves to hazard power 1 within 1e-6 2ms
     × the adjusted expectancy at the solved power reproduces the 17.48 baseline 0ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/montecarlo/survival.evidence.test.ts > survival-hazard-from-expectancy-multiplier — Hazard power for a remaining-years multiplier, solved by bisection > the identity multiplier m = 1 solves to hazard power 1 within 1e-6
AssertionError: expected 0.06365958114647585 to be less than or equal to 0.000001
 ❯ src/montecarlo/survival.evidence.test.ts:166:75
    164|     it('the identity multiplier m = 1 solves to hazard power 1 within …
    165|       const hazard = hazardForExpectancyMultiplier(age, sex, multiplie…
    166|       expect(Math.abs(hazard - (example.expected.hazardPower as number…
       |                                                                           ^
    167|     })
    168|
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯
 FAIL  src/montecarlo/survival.evidence.test.ts > survival-hazard-from-expectancy-multiplier — Hazard power for a remaining-years multiplier, solved by bisection > the adjusted expectancy at the solved power reproduces the 17.48 baseline
AssertionError: expected 0.5000000000162288 to be less than or equal to 0.000001
 ❯ src/montecarlo/survival.evidence.test.ts:182:91
    180|         expectancy += survivalProbabilityTo(age, sex, target, hazard)
    181|       }
    182|       expect(Math.abs(expectancy - (example.expected.adjustedExpectanc…
       |                                                                                           ^
    183|     })
    184|   },
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
 Test Files  1 failed (1)
      Tests  2 failed | 10 passed (12)
```

## Revert

`git checkout -- packages/engine/src/montecarlo/survival.ts`, then `git diff --quiet -- packages/engine/src/montecarlo/survival.ts` exited 0, confirming no change to production code after the run.
