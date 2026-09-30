# Mutation receipt: mortality-joint-last-survivor-expectancy

Executed 2026-09-14 against RetireGolden head `efaeb827` (branch claude/b1-p4-cards-longevity, with the PR #714 round-1 revision of `src/montecarlo/mortality.evidence.test.ts` applied: the planner-ui comparison moved to the planner-ui suite, and B2-P1 slice 4 deleted it with the planner-ui copy of the identity; that run replaced the same-day run against base `2dc2011c`), and re-executed 2026-09-27 against RetireGolden base `b338e430` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `2a93de55` (branch `claude/life-table-2023`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `476abd6e` (branch `claude/life-table-2023`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `b8927e7e` (branch `claude/life-table-2023`, pull request #759) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/mortality.ts`

```diff
@@ -55,7 +55,7 @@
   const survivalB = lifeSurvival(ageB, sexB)
   let expectancy = 0.5
   for (let t = 1; t <= MAX_AGE + 1; t++) {
-    expectancy += 1 - (1 - survivalA(t)) * (1 - survivalB(t))
+    expectancy += survivalA(t)
   }
   return expectancy
 }
```

This adds the single-life survival instead of the either-alive probability, the worksheet's first wrong reading: 0.5 + 0.11752 = 0.61752 years for the two men of 118 instead of 0.7212290496, a 0.1037 miss against the 1e-12 tolerance, and the 70/67 and 'average' cases fail with it. The endpoint case (both at 119) still returns 0.5 under the mutation.

## Command

```
npx vitest run src/montecarlo/mortality.evidence.test.ts
```

## Captured failing output

Re-executed after the PR #759 review fixes: a non-finite age now throws first in sampleDeathAge, jointLastSurvivorExpectancy and hazardForExpectancyMultiplier (review 5), the table module gained the known editions and the published curve gap (reviews 7 and 8), and the provenance catalog gained the 2022 edition (review 1), which moved the lines, test titles and counts these receipts quote. The baseline is green (mortality.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/montecarlo/mortality.evidence.test.ts (16 tests | 3 failed) 252ms
   ❯ mortality-joint-last-survivor-expectancy — Joint last-survivor life expectancy of two independent lives (5)
     × two male lives at 118: 0.5 + (1 - 0.88248^2) = 0.7212290496 years 5ms
     × a man of 70 and a woman of 67: 21.80655867930931 years; two 'average' lives of those ages: the mean of the four sex pairings, 21.52705755500049 1ms
     × floors fractional ages, and a negative age survives with certainty until it reaches 0 1ms

 Test Files  1 failed (1)
      Tests  3 failed | 13 passed (16)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/mortality.evidence.test.ts > mortality-joint-last-survivor-expectancy — Joint last-survivor life expectancy of two independent lives > two male lives at 118: 0.5 + (1 - 0.88248^2) = 0.7212290496 years
AssertionError: jointExpectancyYears 0.61752 is not within {"abs":1e-12} of the worksheet's 0.7212290496: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/mortality.evidence.test.ts:257:9
    255|         withinTolerance(expectancy, expected, example.tolerance),
    256|         `jointExpectancyYears ${expectancy} is not within ${JSON.strin…
    257|       ).toBe(true)
       |         ^
    258|     })
    259|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  src/montecarlo/mortality.evidence.test.ts > mortality-joint-last-survivor-expectancy — Joint last-survivor life expectancy of two independent lives > a man of 70 and a woman of 67: 21.80655867930931 years; two 'average' lives of those ages: the mean of the four sex pairings, 21.52705755500049
AssertionError: 70/67: 14.66361168311186: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/mortality.evidence.test.ts:269:111
    267|     it('a man of 70 and a woman of 67: 21.80655867930931 years; two \'…
    268|       const mixed = jointLastSurvivorExpectancy(70, 'male', 67, 'femal…
    269|       expect(withinTolerance(mixed, jointValue('Man of 70, woman of 67…
       |                                                                                                               ^
    270|       const bothAverage = jointLastSurvivorExpectancy(70, 'average', 6…
    271|       expect(withinTolerance(bothAverage, jointValue('Two \'average\' …

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  src/montecarlo/mortality.evidence.test.ts > mortality-joint-last-survivor-expectancy — Joint last-survivor life expectancy of two independent lives > floors fractional ages, and a negative age survives with certainty until it reaches 0
AssertionError: 0.61752: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/mortality.evidence.test.ts:282:130
    280|     it('floors fractional ages, and a negative age survives with certa…
    281|       const floored = jointLastSurvivorExpectancy(118.7, 'male', 118.2…
    282|       expect(withinTolerance(floored, jointValue('Two men of 118.7 and…
       |                                                                                                                                  ^
    283|       expect(floored).toBe(jointLastSurvivorExpectancy(118, 'male', 11…
    284|       const negative = jointLastSurvivorExpectancy(-2, 'male', 118, 'm…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/mortality.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/mortality.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
