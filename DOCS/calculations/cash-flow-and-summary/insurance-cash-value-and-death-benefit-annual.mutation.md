# Mutation receipt: insurance-cash-value-and-death-benefit-annual

Executed 2026-09-18 against RetireGolden base `60e47fd8` (branch claude/b1-p4-cards-slice-eleven) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualPermanentLifeTransitions.ts`

```diff
@@ -99,7 +99,7 @@
         cashValue = previousCashValue * (1 + (policy.cashValueGrowthPct ?? 0) / 100)
       }
     } else if (ageAttained === deathAge) {
-      payout = Math.max(policy.deathBenefit, cashValueFor(policy.id))
+      payout = policy.deathBenefit
       deathBenefitPaid += payout
       cashValue = 0
     } else {
```

This settles at the face amount instead of `max(face, cash value)`, publishing a death benefit of $50,000 — the worksheet's second wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualPermanentLifeTransitions.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-18 against base `2088f4bb`, after the worksheet was re-derived with the settling policy's input row at attained age 70 — the death year — and its fixture rebuilt: the death-year case is now read straight off the Inputs table, and attained age 71 is asserted as the worksheet's last wrong reading rather than as a worksheet defect. The same mutation still fails the settlement assertion, now under the renamed test. The baseline is green: annualPermanentLifeTransitions.evidence.test.ts passes on unmodified production. Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
 RUN  v5.0.0 C:/TEMP/rg-s11/packages/engine

 ❯ src/projection/internal/annualPermanentLifeTransitions.evidence.test.ts (2 tests | 1 failed) 5ms
   ❯ insurance-cash-value-and-death-benefit-annual — Annual permanent-life cash value and death-year settlement (2)
     × interpolates 30000 of living cash value and settles 60000 on the max rule at attained age 70 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 1 passed (2)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/annualPermanentLifeTransitions.evidence.test.ts > insurance-cash-value-and-death-benefit-annual — Annual permanent-life cash value and death-year settlement > interpolates 30000 of living cash value and settles 60000 on the max rule at attained age 70
AssertionError: deathBenefit 50000 is not within {"abs":0.005} of the worksheet's 60000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/annualPermanentLifeTransitions.evidence.test.ts:16:5
     14|     withinTolerance(actual, target, tolerance),
     15|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     16|   ).toBe(true)
       |     ^
     17| }
     18|
 ❯ src/projection/internal/annualPermanentLifeTransitions.evidence.test.ts:104:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

`git checkout -- packages/engine/src/projection/internal/annualPermanentLifeTransitions.ts`, then `git diff --quiet -- packages/engine/src/projection/internal/annualPermanentLifeTransitions.ts` exited 0, confirming no change to production code after the run.
