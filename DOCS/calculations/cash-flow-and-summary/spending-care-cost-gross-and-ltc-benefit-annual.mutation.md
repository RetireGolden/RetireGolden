# Mutation receipt: spending-care-cost-gross-and-ltc-benefit-annual

Executed 2026-09-18 against RetireGolden base `60e47fd8` (branch claude/b1-p4-cards-slice-eleven) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualDebtAndLongTermCare.ts`

```diff
@@ -128,9 +128,6 @@
         12 *
         Math.pow(1 + rider, input.year - input.startYear)
       // The first episode year bears the elimination period out of pocket.
-      if (yearsIntoEpisode === 0) {
-        cap *= Math.max(0, 1 - policy.eliminationPeriodDays / 365)
-      }
       const pay = Math.min(remaining, cap)
       if (pay > 0) {
         ltcBenefit += pay
```

This drops the first-year elimination-period haircut on the policy cap, publishing a benefit of $66,150 — the worksheet's second wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualDebtAndLongTermCare.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/projection/internal/annualDebtAndLongTermCare.evidence.test.ts > spending-care-cost-gross-and-ltc-benefit-annual — Annual gross care cost and the LTC benefit against it > charges 72600 of gross care and reimburses 49839.0410958904 after the elimination haircut
AssertionError: expenses.ltcBenefit 66150 is not within {"abs":0.005} of the worksheet's 49839.0410958904: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/internal/annualDebtAndLongTermCare.ts`, then `git diff --quiet -- packages/engine/src/projection/internal/annualDebtAndLongTermCare.ts` exited 0, confirming no change to production code after the run.
