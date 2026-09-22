# Mutation receipt: spending-required-requested-annual

Executed 2026-09-18 against RetireGolden base `39f8f460` (branch claude/b1-p4-cards-slice-nine) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualExpenseSummary.ts`

```diff
@@ -84,7 +84,7 @@ export function annualExpenseSummary(
     careCost: input.careCost,
     ltcBenefit: input.ltcBenefit,
     requiredSpending:
-      requiredSpendingBase + input.skippedRequiredNominal,
+      requiredSpendingBase,
     targetSpending:
       targetSpendingBase +
       input.skippedTargetNominal +
```

This omits the skipped required goal, publishing $44,500 — the worksheet's first wrong reading. The target and intended fixtures in the same file fail alongside, because both carry the required base.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualExpenseSummary.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/projection/internal/annualExpenseSummary.evidence.test.ts > spending-required-requested-annual — Annual required-layer requested spending > adds system costs, required lifestyle, funded goals and the skipped goal to 46000
AssertionError: requiredSpending 44500 is not within {"abs":0.005} of the worksheet's 46000: expected false to be true // Object.is equality
 FAIL  src/projection/internal/annualExpenseSummary.evidence.test.ts > spending-target-requested-annual — Annual target-layer requested spending > carries the full target layer and each skipped amount once: 62500
AssertionError: requiredSpending 44500 is not within {"abs":0.005} of the worksheet's 46000: expected false to be true // Object.is equality
 FAIL  src/projection/internal/annualExpenseSummary.evidence.test.ts > spending-intended-annual — Annual intended spending with no guardrail cut > adds the target base and the two increments, each skipped goal once: 85250
AssertionError: requiredSpending 52000 is not within {"abs":0.005} of the worksheet's 53000: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/internal/annualExpenseSummary.ts`, then `git diff --quiet -- packages/engine/src/projection/internal/annualExpenseSummary.ts` exited 0, confirming no change to production code after the run.
