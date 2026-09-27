# Mutation receipt: survival-percentile-age

Executed 2026-09-14 against RetireGolden base `2dc2011c` (branch claude/b1-p4-cards-longevity), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet) in `packages/engine`.

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

Re-executed for D-RECEIPT-DRIFT because the test lines it quoted no longer matched the current test file; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (survival.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine9/packages/engine

 ❯ src/montecarlo/survival.evidence.test.ts (12 tests | 3 failed) 8ms
   ❯ survival-percentile-age — Survival-percentile planning age: oldest age reached with probability at least pct/100 (3)
     × the oldest age with conditional survival >= 97% from 65 is 66 4ms
     × is bounded below by the current age: a 100% threshold returns 65 0ms
   ❯ joint-survival-percentile-age — Joint (either-survives) percentile age on the primary's age clock (4)
     × exceeds the single-life 99th-percentile age of 65, which the last-survivor construction must not return 0ms

 Test Files  1 failed (1)
      Tests  3 failed | 9 passed (12)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/survival.evidence.test.ts > survival-percentile-age — Survival-percentile planning age: oldest age reached with probability at least pct/100 > the oldest age with conditional survival >= 97% from 65 is 66
AssertionError: expected 67 to be 66 // Object.is equality

- Expected
+ Received

- 66
+ 67

 ❯ src/montecarlo/survival.evidence.test.ts:65:67
     63|
     64|     it('the oldest age with conditional survival >= 97% from 65 is 66'…
     65|       expect(survivalPercentileAge(currentAge, sex, pct, hazard)).toBe…
       |                                                                   ^
     66|     })
     67|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  src/montecarlo/survival.evidence.test.ts > survival-percentile-age — Survival-percentile planning age: oldest age reached with probability at least pct/100 > is bounded below by the current age: a 100% threshold returns 65
AssertionError: expected 66 to be 65 // Object.is equality

- Expected
+ Received

- 65
+ 66

 ❯ src/montecarlo/survival.evidence.test.ts:77:67
     75|       // Boundary of the claim: S(66) < 1, so no later age qualifies a…
     76|       // current age, already reached, is the answer.
     77|       expect(survivalPercentileAge(currentAge, sex, 100, hazard)).toBe…
       |                                                                   ^
     78|     })
     79|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  src/montecarlo/survival.evidence.test.ts > joint-survival-percentile-age — Joint (either-survives) percentile age on the primary's age clock > exceeds the single-life 99th-percentile age of 65, which the last-survivor construction must not return
AssertionError: expected 66 to be 65 // Object.is equality

- Expected
+ Received

- 65
+ 66

 ❯ src/montecarlo/survival.evidence.test.ts:142:84
    140|     it('exceeds the single-life 99th-percentile age of 65, which the l…
    141|       // The worksheet's second wrong reading: one person's answer.
    142|       expect(survivalPercentileAge(primary.age, primary.sex, pct, prim…
       |                                                                                    ^
    143|       expect(jointSurvivalPercentileAge(primary, partner, pct)).toBeGr…
    144|     })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/survival.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/survival.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
