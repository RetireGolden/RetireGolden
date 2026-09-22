# Mutation receipt: spending-base-annual

Executed 2026-09-18 against RetireGolden base `39f8f460` (branch claude/b1-p4-cards-slice-nine) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualExpenseSummary.ts`

```diff
@@ -62,7 +62,8 @@ export function annualExpenseSummary(
     input.requiredLifestyle +
     input.targetLifestyleFunded +
     input.idealLifestyleFunded +
-    input.excessLifestyleFunded
+    input.excessLifestyleFunded +
+    input.oneTimeGoalsFunded
   const requiredSpendingBase =
     input.systemRequired + input.requiredLifestyle + input.requiredGoalsFunded
   const targetSpendingBase =
```

This folds the one-time goal into base spending, publishing $67,500 — the worksheet's second wrong reading. The expense-total fixture in the same file fails alongside, because base spending is one of its members.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualExpenseSummary.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/projection/internal/annualExpenseSummary.evidence.test.ts > spending-total-annual — Annual net expense total > nets the eight members to 94000 and ignores the factor and the request
AssertionError: baseSpending 60000 is not within {"abs":0.005} of the worksheet's 54000: expected false to be true // Object.is equality
 FAIL  src/projection/internal/annualExpenseSummary.evidence.test.ts > spending-base-annual — Annual base spending after the guardrail cut > caps the target layer at the factor and leaves the one-time goal out: 59500
AssertionError: baseSpending 67500 is not within {"abs":0.005} of the worksheet's 59500: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/internal/annualExpenseSummary.ts`, then `git diff --quiet -- packages/engine/src/projection/internal/annualExpenseSummary.ts` exited 0, confirming no change to production code after the run.
