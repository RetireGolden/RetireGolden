# Mutation receipt: joint-survival-percentile-age

Executed 2026-09-14 against RetireGolden base `2dc2011c` (branch claude/b1-p4-cards-longevity) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/survival.ts`

```diff
@@ -95,7 +95,7 @@ export function jointSurvivalPercentileAge(
   // Walk both survival curves on the primary's clock; the partner's own clock
   // is offset by the age difference.
   for (let t = 0; from + t <= MAX_AGE + 1; t++) {
-    const eitherAlive = 1 - (1 - sPrimary) * (1 - sPartner)
+    const eitherAlive = sPrimary * sPartner
     if (eitherAlive >= threshold) best = from + t
     else break
     sPrimary *= annualSurvival(from + t, primary.sex, primary.hazard ?? 1)
```

This tests the both-alive probability S_a S_b instead of either-alive 1 - (1 - S_a)(1 - S_b), the worksheet's first wrong reading: S(66)^2 = 0.9645 is already below 0.99, so the walk stops at t = 1 and returns the current age 65 instead of 70. The contrast with the single-life answer fails with it, because the joint age no longer exceeds 65.

## Command

```
npx vitest run src/montecarlo/survival.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1`, stdout and stderr together; stdout precedes stderr, so the run summary appears before the failed-test detail. Blank lines and the `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-b1p4long/packages/engine
 ❯ src/montecarlo/survival.evidence.test.ts (12 tests | 2 failed) 7ms
   ❯ joint-survival-percentile-age — Joint (either-survives) percentile age on the primary's age clock (4)
     × two 65-year-old men at 99%: the last-survivor percentile age is 70 3ms
     × exceeds the single-life 99th-percentile age of 65, which the last-survivor construction must not return 0ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/montecarlo/survival.evidence.test.ts > joint-survival-percentile-age — Joint (either-survives) percentile age on the primary's age clock > two 65-year-old men at 99%: the last-survivor percentile age is 70
AssertionError: expected 65 to be 70 // Object.is equality
- Expected
+ Received
- 70
+ 65
 ❯ src/montecarlo/survival.evidence.test.ts:113:65
    111|
    112|     it('two 65-year-old men at 99%: the last-survivor percentile age i…
    113|       expect(jointSurvivalPercentileAge(primary, partner, pct)).toBe(e…
       |                                                                 ^
    114|     })
    115|
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯
 FAIL  src/montecarlo/survival.evidence.test.ts > joint-survival-percentile-age — Joint (either-survives) percentile age on the primary's age clock > exceeds the single-life 99th-percentile age of 65, which the last-survivor construction must not return
AssertionError: expected 65 to be greater than 65
 ❯ src/montecarlo/survival.evidence.test.ts:138:65
    136|       // The worksheet's second wrong reading: one person's answer.
    137|       expect(survivalPercentileAge(primary.age, primary.sex, pct, prim…
    138|       expect(jointSurvivalPercentileAge(primary, partner, pct)).toBeGr…
       |                                                                 ^
    139|     })
    140|   },
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
 Test Files  1 failed (1)
      Tests  2 failed | 10 passed (12)
```

## Revert

`git checkout -- packages/engine/src/montecarlo/survival.ts`, then `git diff --quiet -- packages/engine/src/montecarlo/survival.ts` exited 0, confirming no change to production code after the run.
