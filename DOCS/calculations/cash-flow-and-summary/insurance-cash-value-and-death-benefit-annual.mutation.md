# Mutation receipt: insurance-cash-value-and-death-benefit-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eleven` at base `60e47fd8`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730) in `packages/engine`.

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

Re-executed 2026-09-22 on the pull-request branch after the review of #730: the branch was renamed for the pull request, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (annualPermanentLifeTransitions.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

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

The original bytes of `packages/engine/src/projection/internal/annualPermanentLifeTransitions.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/annualPermanentLifeTransitions.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
