# Mutation receipt: survival-percentile-age

Executed 2026-09-14 against RetireGolden base `2dc2011c` (branch claude/b1-p4-cards-longevity), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `20b95c74` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `2a93de55` (branch `claude/life-table-2023`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `476abd6e` (branch `claude/life-table-2023`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/survival.ts`

```diff
@@ -195,8 +195,10 @@
   const curve = runningSurvival(from, sex, hazard)
   let best = from
   for (let t = 1; from + t <= MAX_AGE + 1; t++) {
-    if (curve.survivalTo(t) >= threshold) best = from + t
-    else break
+    if (curve.survivalTo(t) < threshold) {
+      best = from + t
+      break
+    }
   }
   return best
 }
```

This returns the first failing age instead of the last qualifying one, the worksheet's first wrong reading: 67 instead of 66 under the exact tolerance. The 100%-threshold boundary fails the same way (66 instead of 65), the ages at 50, 25 and 10 percent come out one year older for each sex, and the joint block's single-life contrast and the hazard block's pick at m = 1, which call the same function, report 66 where the worksheet says 65 and 96 where it says 95.

## Command

```
npx vitest run src/montecarlo/survival.evidence.test.ts
```

## Captured failing output

Re-executed after the D-LIFE-TABLE-2023 review fixes (the death probability in a leaf module, the new evidence cases). The baseline is green (survival.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine15/packages/engine

 ❯ src/montecarlo/survival.evidence.test.ts (22 tests | 5 failed) 122ms
   ❯ survival-percentile-age — Survival-percentile planning age: oldest age reached with probability at least pct/100 (5)
     × the oldest age with conditional survival >= 97% from 65 is 66 4ms
     × is bounded below by the current age: a 100% threshold returns 65 0ms
     × reads 'average' off the mixture: 85/91/95 at 65, not the means of a man's 83/89/94 and a woman's 86/92/96 1ms
   ❯ joint-survival-percentile-age — Joint (either-survives) percentile age on the primary's age clock (5)
     × exceeds the single-life 99th-percentile age of 65, which the last-survivor construction must not return 0ms
   ❯ survival-hazard-from-expectancy-multiplier — Hazard power for a remaining-years multiplier: exactly 1 at m = 1, otherwise solved by bisection (5)
     × a pick at m = 1 does not move: a woman of 25 at 10 percent gets 95, the unadjusted pick 0ms

 Test Files  1 failed (1)
      Tests  5 failed | 17 passed (22)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 5 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/survival.evidence.test.ts > survival-percentile-age — Survival-percentile planning age: oldest age reached with probability at least pct/100 > the oldest age with conditional survival >= 97% from 65 is 66
AssertionError: expected 67 to be 66 // Object.is equality

- Expected
+ Received

- 66
+ 67

 ❯ src/montecarlo/survival.evidence.test.ts:171:67
    169|
    170|     it('the oldest age with conditional survival >= 97% from 65 is 66'…
    171|       expect(survivalPercentileAge(currentAge, sex, pct, hazard)).toBe…
       |                                                                   ^
    172|       expect(ages('Male from 65 at 97%')).toEqual([example.expected.pe…
    173|     })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/5]⎯

 FAIL  src/montecarlo/survival.evidence.test.ts > survival-percentile-age — Survival-percentile planning age: oldest age reached with probability at least pct/100 > is bounded below by the current age: a 100% threshold returns 65
AssertionError: expected 66 to be 65 // Object.is equality

- Expected
+ Received

- 65
+ 66

 ❯ src/montecarlo/survival.evidence.test.ts:184:67
    182|       // Boundary of the claim: S(66) < 1, so no later age qualifies a…
    183|       // current age, already reached, is the answer.
    184|       expect(survivalPercentileAge(currentAge, sex, 100, hazard)).toBe…
       |                                                                   ^
    185|     })
    186|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/5]⎯

 FAIL  src/montecarlo/survival.evidence.test.ts > survival-percentile-age — Survival-percentile planning age: oldest age reached with probability at least pct/100 > reads 'average' off the mixture: 85/91/95 at 65, not the means of a man's 83/89/94 and a woman's 86/92/96
AssertionError: expected [ 84, 90, 95 ] to deeply equal [ 83, 89, 94 ]

- Expected
+ Received

  [
-   83,
-   89,
-   94,
+   84,
+   90,
+   95,
  ]

 ❯ src/montecarlo/survival.evidence.test.ts:194:26
    192|     it('reads \'average\' off the mixture: 85/91/95 at 65, not the mea…
    193|       const at = (s: Sex) => [50, 25, 10].map((p) => survivalPercentil…
    194|       expect(at('male')).toEqual(ages('Male from 65 at 50%, 25%, 10%'))
       |                          ^
    195|       expect(at('female')).toEqual(ages('Female from 65 at 50%, 25%, 1…
    196|       expect(at('average')).toEqual(ages('Average from 65 at 50%, 25%,…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/5]⎯

 FAIL  src/montecarlo/survival.evidence.test.ts > joint-survival-percentile-age — Joint (either-survives) percentile age on the primary's age clock > exceeds the single-life 99th-percentile age of 65, which the last-survivor construction must not return
AssertionError: expected 66 to be 65 // Object.is equality

- Expected
+ Received

- 65
+ 66

 ❯ src/montecarlo/survival.evidence.test.ts:273:84
    271|     it('exceeds the single-life 99th-percentile age of 65, which the l…
    272|       // The worksheet's second wrong reading: one person's answer.
    273|       expect(survivalPercentileAge(primary.age, primary.sex, pct, prim…
       |                                                                                    ^
    274|       expect(jointSurvivalPercentileAge(primary, partner, pct)).toBeGr…
    275|     })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/5]⎯

 FAIL  src/montecarlo/survival.evidence.test.ts > survival-hazard-from-expectancy-multiplier — Hazard power for a remaining-years multiplier: exactly 1 at m = 1, otherwise solved by bisection > a pick at m = 1 does not move: a woman of 25 at 10 percent gets 95, the unadjusted pick
AssertionError: expected 96 to be 95 // Object.is equality

- Expected
+ Received

- 95
+ 96

 ❯ src/montecarlo/survival.evidence.test.ts:334:58
    332|     it('a pick at m = 1 does not move: a woman of 25 at 10 percent get…
    333|       const h = hazardForExpectancyMultiplier(25, 'female', 1)
    334|       expect(survivalPercentileAge(25, 'female', 10, h)).toBe(sheet('F…
       |                                                          ^
    335|       expect(survivalPercentileAge(25, 'female', 10, h)).toBe(survival…
    336|     })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/5]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/survival.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/survival.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
