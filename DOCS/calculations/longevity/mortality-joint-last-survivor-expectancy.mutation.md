# Mutation receipt: mortality-joint-last-survivor-expectancy

Executed 2026-09-14 against RetireGolden head `efaeb827` (branch claude/b1-p4-cards-longevity) in `packages/engine`, with the PR #714 round-1 revision of `src/montecarlo/mortality.evidence.test.ts` applied (the planner-ui comparison moved to the planner-ui suite, so the file carries 11 tests). This run replaces the same-day run against base `2dc2011c`.

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
 ❯ src/montecarlo/mortality.evidence.test.ts (11 tests | 1 failed) 6ms
   ❯ mortality-joint-last-survivor-expectancy — Joint last-survivor life expectancy of two independent lives (4)
     × two male lives at 118: 0.5 + (1 - 0.96^2) = 0.5784 years 3ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/montecarlo/mortality.evidence.test.ts > mortality-joint-last-survivor-expectancy — Joint last-survivor life expectancy of two independent lives > two male lives at 118: 0.5 + (1 - 0.96^2) = 0.5784 years
AssertionError: jointExpectancyYears 0.54 is not within {"abs":1e-12} of the worksheet's 0.5784: expected false to be true // Object.is equality
- Expected
+ Received
- true
+ false
 ❯ src/montecarlo/mortality.evidence.test.ts:185:9
    183|         withinTolerance(expectancy, expected, example.tolerance),
    184|         `jointExpectancyYears ${expectancy} is not within ${JSON.strin…
    185|       ).toBe(true)
       |         ^
    186|     })
    187|
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
 Test Files  1 failed (1)
      Tests  1 failed | 10 passed (11)
```

## Revert

`git checkout -- packages/engine/src/montecarlo/mortality.ts`, then `git diff --quiet -- packages/engine/src/montecarlo/mortality.ts` exited 0, confirming no change to production code after the run.
