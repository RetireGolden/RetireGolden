# Mutation receipt: withdrawals-total-annual

Executed 2026-09-18 against RetireGolden base `39f8f460` (branch claude/b1-p4-cards-slice-nine) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualWithdrawalPlanning.ts`

```diff
@@ -306,8 +306,7 @@ export function annualWithdrawalPlan(
     byCategory.cash +
     byCategory.taxable +
     byCategory.traditional +
-    byCategory.roth +
-    byCategory.hsa
+    byCategory.roth
   return {
     byCategory,
     byAccountId,
```

This drops the HSA category from the withdrawal total, publishing $40,000 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualFundingApplicationAndClosePhase.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/projection/internal/annualFundingApplicationAndClosePhase.evidence.test.ts > withdrawals-total-annual — Annual withdrawal total > sums the five categories to 42000
AssertionError: withdrawals.total 40000 is not within {"abs":0.005} of the worksheet's 42000: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/internal/annualWithdrawalPlanning.ts`, then `git diff --quiet -- packages/engine/src/projection/internal/annualWithdrawalPlanning.ts` exited 0, confirming no change to production code after the run.
