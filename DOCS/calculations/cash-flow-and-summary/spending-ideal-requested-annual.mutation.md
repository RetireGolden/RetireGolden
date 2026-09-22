# Mutation receipt: spending-ideal-requested-annual

Executed 2026-09-18 against RetireGolden base `39f8f460` (branch claude/b1-p4-cards-slice-nine) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualExpenseSummary.ts`

```diff
@@ -89,7 +89,7 @@ export function annualExpenseSummary(
       targetSpendingBase +
       input.skippedTargetNominal +
       input.skippedRequiredNominal,
-    idealSpending: idealSpendingBase + input.skippedIdealNominal,
+    idealSpending: targetSpendingBase + idealSpendingBase + input.skippedIdealNominal,
     excessSpending: excessSpendingBase + input.skippedExcessNominal,
     intendedSpending:
       targetSpendingBase +
```

This makes the ideal layer cumulative rather than incremental, publishing $80,000 — the worksheet's first wrong reading. The excess and intended fixtures in the same file fail alongside, because the ideal increment enters both.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualExpenseSummary.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/projection/internal/annualExpenseSummary.evidence.test.ts > spending-ideal-requested-annual — Annual ideal-layer requested spending > isolates the 10000 ideal increment from the worksheet's four summaries
AssertionError: idealSpending 80000 is not within {"abs":0.005} of the worksheet's 10000: expected false to be true // Object.is equality
 FAIL  src/projection/internal/annualExpenseSummary.evidence.test.ts > spending-excess-requested-annual — Annual excess-layer requested spending > isolates the 5000 excess increment from the worksheet's four summaries
AssertionError: idealSpending 80000 is not within {"abs":0.005} of the worksheet's 10000: expected false to be true // Object.is equality
 FAIL  src/projection/internal/annualExpenseSummary.evidence.test.ts > spending-intended-annual — Annual intended spending with no guardrail cut > adds the target base and the two increments, each skipped goal once: 85250
AssertionError: idealSpending 77500 is not within {"abs":0.005} of the worksheet's 7500: expected false to be true // Object.is equality
 FAIL  src/projection/internal/annualExpenseSummary.evidence.test.ts > spending-intended-annual — Annual intended spending with no guardrail cut > equals target plus the two increments on a real projection row
AssertionError: intendedSpending against its own published layers 79500 is not within {"abs":0.005} of the worksheet's 153500: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/internal/annualExpenseSummary.ts`, then `git diff --quiet -- packages/engine/src/projection/internal/annualExpenseSummary.ts` exited 0, confirming no change to production code after the run.
