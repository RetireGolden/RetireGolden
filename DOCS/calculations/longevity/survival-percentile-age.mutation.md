# Mutation receipt: survival-percentile-age

Executed 2026-09-14 against RetireGolden base `2dc2011c` (branch claude/b1-p4-cards-longevity) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/survival.ts`

```diff
@@ -63,8 +63,10 @@ export function survivalPercentileAge(
   let best = from
   for (let age = from; age <= MAX_AGE; age++) {
     s *= annualSurvival(age, sex, hazard)
-    if (s >= threshold) best = age + 1
-    else break
+    if (s < threshold) {
+      best = age + 1
+      break
+    }
   }
   return best
 }
```

This returns the first failing age instead of the last qualifying one, the worksheet's first wrong reading: 67 instead of 66 under the exact tolerance. The 100%-threshold boundary fails the same way (66 instead of 65), and the joint block's single-life contrast, which calls the same function, reports 66 where the worksheet says 65.

## Command

```
npx vitest run src/montecarlo/survival.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1`, stdout and stderr together; stdout precedes stderr, so the run summary appears before the failed-test detail. Blank lines and the `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-b1p4long/packages/engine
 ❯ src/montecarlo/survival.evidence.test.ts (12 tests | 3 failed) 7ms
   ❯ survival-percentile-age — Survival-percentile planning age: oldest age reached with probability at least pct/100 (3)
     × the oldest age with conditional survival >= 97% from 65 is 66 3ms
     × is bounded below by the current age: a 100% threshold returns 65 0ms
   ❯ joint-survival-percentile-age — Joint (either-survives) percentile age on the primary's age clock (4)
     × exceeds the single-life 99th-percentile age of 65, which the last-survivor construction must not return 0ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/montecarlo/survival.evidence.test.ts > survival-percentile-age — Survival-percentile planning age: oldest age reached with probability at least pct/100 > the oldest age with conditional survival >= 97% from 65 is 66
AssertionError: expected 67 to be 66 // Object.is equality
- Expected
+ Received
- 66
+ 67
 ❯ src/montecarlo/survival.evidence.test.ts:66:67
     64|
     65|     it('the oldest age with conditional survival >= 97% from 65 is 66'…
     66|       expect(survivalPercentileAge(currentAge, sex, pct, hazard)).toBe…
       |                                                                   ^
     67|     })
     68|
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯
 FAIL  src/montecarlo/survival.evidence.test.ts > survival-percentile-age — Survival-percentile planning age: oldest age reached with probability at least pct/100 > is bounded below by the current age: a 100% threshold returns 65
AssertionError: expected 66 to be 65 // Object.is equality
- Expected
+ Received
- 65
+ 66
 ❯ src/montecarlo/survival.evidence.test.ts:78:67
     76|       // Boundary of the claim: S(66) < 1, so no later age qualifies a…
     77|       // current age, already reached, is the answer.
     78|       expect(survivalPercentileAge(currentAge, sex, 100, hazard)).toBe…
       |                                                                   ^
     79|     })
     80|   },
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯
 FAIL  src/montecarlo/survival.evidence.test.ts > joint-survival-percentile-age — Joint (either-survives) percentile age on the primary's age clock > exceeds the single-life 99th-percentile age of 65, which the last-survivor construction must not return
AssertionError: expected 66 to be 65 // Object.is equality
- Expected
+ Received
- 65
+ 66
 ❯ src/montecarlo/survival.evidence.test.ts:137:84
    135|     it('exceeds the single-life 99th-percentile age of 65, which the l…
    136|       // The worksheet's second wrong reading: one person's answer.
    137|       expect(survivalPercentileAge(primary.age, primary.sex, pct, prim…
       |                                                                                    ^
    138|       expect(jointSurvivalPercentileAge(primary, partner, pct)).toBeGr…
    139|     })
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
 Test Files  1 failed (1)
      Tests  3 failed | 9 passed (12)
```

## Revert

`git checkout -- packages/engine/src/montecarlo/survival.ts`, then `git diff --quiet -- packages/engine/src/montecarlo/survival.ts` exited 0, confirming no change to production code after the run.
