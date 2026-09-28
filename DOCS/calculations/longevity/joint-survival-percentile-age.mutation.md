# Mutation receipt: joint-survival-percentile-age

Executed 2026-09-14 against RetireGolden base `2dc2011c` (branch claude/b1-p4-cards-longevity), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `20b95c74` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `2a93de55` (branch `claude/life-table-2023`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `476abd6e` (branch `claude/life-table-2023`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/survival.ts`

```diff
@@ -231,7 +231,7 @@
     const sPrimary = primaryCurve.survivalTo(t)
     const sPartner = partnerCurve.survivalTo(t)
     if (t > 0 && sPrimary <= 0 && sPartner <= 0) break
-    const eitherAlive = 1 - (1 - sPrimary) * (1 - sPartner)
+    const eitherAlive = sPrimary * sPartner
     if (eitherAlive >= threshold) best = from + t
     else break
   }
```

This tests the both-alive probability S_a S_b instead of either-alive 1 - (1 - S_a)(1 - S_b), the worksheet's first wrong reading: S(66)^2 = 0.983545^2 = 0.9674 is already below 0.99, so the walk stops at t = 1 and returns the current age 65 instead of 70. The contrast with the single-life answer fails with it, because the joint age no longer exceeds 65.

## Command

```
npx vitest run src/montecarlo/survival.evidence.test.ts
```

## Captured failing output

Re-executed after the D-LIFE-TABLE-2023 review fixes (the death probability in a leaf module, the new evidence cases). The baseline is green (survival.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine15/packages/engine

 ❯ src/montecarlo/survival.evidence.test.ts (22 tests | 3 failed) 122ms
   ❯ joint-survival-percentile-age — Joint (either-survives) percentile age on the primary's age clock (5)
     × two 65-year-old men at 99%: the last-survivor percentile age is 70 3ms
     × applies the partner's hazard to the partner's curve: a man of 65 with a woman of 63 at hazard 1.5 is 89/93/96, not 91/95/99 1ms
     × exceeds the single-life 99th-percentile age of 65, which the last-survivor construction must not return 0ms

 Test Files  1 failed (1)
      Tests  3 failed | 19 passed (22)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/survival.evidence.test.ts > joint-survival-percentile-age — Joint (either-survives) percentile age on the primary's age clock > two 65-year-old men at 99%: the last-survivor percentile age is 70
AssertionError: expected 65 to be 70 // Object.is equality

- Expected
+ Received

- 70
+ 65

 ❯ src/montecarlo/survival.evidence.test.ts:231:65
    229|
    230|     it('two 65-year-old men at 99%: the last-survivor percentile age i…
    231|       expect(jointSurvivalPercentileAge(primary, partner, pct)).toBe(e…
       |                                                                 ^
    232|     })
    233|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  src/montecarlo/survival.evidence.test.ts > joint-survival-percentile-age — Joint (either-survives) percentile age on the primary's age clock > applies the partner's hazard to the partner's curve: a man of 65 with a woman of 63 at hazard 1.5 is 89/93/96, not 91/95/99
AssertionError: expected [ 78, 84, 88 ] to deeply equal [ 89, 93, 96 ]

- Expected
+ Received

  [
-   89,
-   93,
-   96,
+   78,
+   84,
+   88,
  ]

 ❯ src/montecarlo/survival.evidence.test.ts:267:80
    265|       const him = { age: 65, sex: 'male' as const, hazard: 1 }
    266|       const her = { age: 63, sex: 'female' as const, hazard: 1.5 }
    267|       expect([50, 25, 10].map((p) => jointSurvivalPercentileAge(him, h…
       |                                                                                ^
    268|       expect([50, 25, 10].map((p) => jointSurvivalPercentileAge(him, {…
    269|     })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  src/montecarlo/survival.evidence.test.ts > joint-survival-percentile-age — Joint (either-survives) percentile age on the primary's age clock > exceeds the single-life 99th-percentile age of 65, which the last-survivor construction must not return
AssertionError: expected 65 to be greater than 65
 ❯ src/montecarlo/survival.evidence.test.ts:274:65
    272|       // The worksheet's second wrong reading: one person's answer.
    273|       expect(survivalPercentileAge(primary.age, primary.sex, pct, prim…
    274|       expect(jointSurvivalPercentileAge(primary, partner, pct)).toBeGr…
       |                                                                 ^
    275|     })
    276|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/survival.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/survival.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
