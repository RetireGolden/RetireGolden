# Mutation receipt: joint-survival-percentile-age

Executed 2026-09-14 against RetireGolden base `2dc2011c` (branch claude/b1-p4-cards-longevity), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet) in `packages/engine`.

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

Re-executed for D-RECEIPT-DRIFT because the test lines it quoted no longer matched the current test file; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (survival.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine9/packages/engine

 ❯ src/montecarlo/survival.evidence.test.ts (12 tests | 2 failed) 8ms
   ❯ joint-survival-percentile-age — Joint (either-survives) percentile age on the primary's age clock (4)
     × two 65-year-old men at 99%: the last-survivor percentile age is 70 4ms
     × exceeds the single-life 99th-percentile age of 65, which the last-survivor construction must not return 0ms

 Test Files  1 failed (1)
      Tests  2 failed | 10 passed (12)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/survival.evidence.test.ts > joint-survival-percentile-age — Joint (either-survives) percentile age on the primary's age clock > two 65-year-old men at 99%: the last-survivor percentile age is 70
AssertionError: expected 65 to be 70 // Object.is equality

- Expected
+ Received

- 70
+ 65

 ❯ src/montecarlo/survival.evidence.test.ts:111:65
    109|
    110|     it('two 65-year-old men at 99%: the last-survivor percentile age i…
    111|       expect(jointSurvivalPercentileAge(primary, partner, pct)).toBe(e…
       |                                                                 ^
    112|     })
    113|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/montecarlo/survival.evidence.test.ts > joint-survival-percentile-age — Joint (either-survives) percentile age on the primary's age clock > exceeds the single-life 99th-percentile age of 65, which the last-survivor construction must not return
AssertionError: expected 65 to be greater than 65
 ❯ src/montecarlo/survival.evidence.test.ts:143:65
    141|       // The worksheet's second wrong reading: one person's answer.
    142|       expect(survivalPercentileAge(primary.age, primary.sex, pct, prim…
    143|       expect(jointSurvivalPercentileAge(primary, partner, pct)).toBeGr…
       |                                                                 ^
    144|     })
    145|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/survival.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/survival.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
