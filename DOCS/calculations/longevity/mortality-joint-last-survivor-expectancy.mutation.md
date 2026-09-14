# Mutation receipt: mortality-joint-last-survivor-expectancy

Executed 2026-09-14 against RetireGolden base `2dc2011c` (branch claude/b1-p4-cards-longevity) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/mortality.ts`

```diff
@@ -61,7 +61,7 @@ export function jointLastSurvivorExpectancy(ageA: number, sexA: Sex, ageB: numbe
   for (let t = 1; t <= MAX_AGE + 1; t++) {
     survivalA *= 1 - annualMortality(ageA + t - 1, sexA)
     survivalB *= 1 - annualMortality(ageB + t - 1, sexB)
-    expectancy += 1 - (1 - survivalA) * (1 - survivalB)
+    expectancy += survivalA
   }
   return expectancy
 }
```

This adds the single-life survival instead of the either-alive probability, the worksheet's first wrong reading: 0.5 + 0.04 = 0.54 years instead of 0.5784, a 0.0384 miss against the 1e-12 tolerance. The endpoint case (both at 119) still returns 0.5 under the mutation, so only the worksheet example fails.

## Command

```
npx vitest run src/montecarlo/mortality.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1`, stdout and stderr together; stdout precedes stderr, so the run summary appears before the failed-test detail. Blank lines and the `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-b1p4long/packages/engine
 ❯ src/montecarlo/mortality.evidence.test.ts (12 tests | 1 failed) 47ms
   ❯ mortality-joint-last-survivor-expectancy — Joint last-survivor life expectancy of two independent lives (4)
     × two male lives at 118: 0.5 + (1 - 0.96^2) = 0.5784 years 2ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/montecarlo/mortality.evidence.test.ts > mortality-joint-last-survivor-expectancy — Joint last-survivor life expectancy of two independent lives > two male lives at 118: 0.5 + (1 - 0.96^2) = 0.5784 years
AssertionError: expected 0.03839999999999999 to be less than or equal to 1e-12
 ❯ src/montecarlo/mortality.evidence.test.ts:187:88
    185|     it('two male lives at 118: 0.5 + (1 - 0.96^2) = 0.5784 years', () …
    186|       const expectancy = jointLastSurvivorExpectancy(ageA, sexA, ageB,…
    187|       expect(Math.abs(expectancy - (example.expected.jointExpectancyYe…
       |                                                                                        ^
    188|     })
    189|
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
 Test Files  1 failed (1)
      Tests  1 failed | 11 passed (12)
```

## Revert

`git checkout -- packages/engine/src/montecarlo/mortality.ts`, then `git diff --quiet -- packages/engine/src/montecarlo/mortality.ts` exited 0, confirming no change to production code after the run.
