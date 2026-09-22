# Mutation receipt: spending-target-requested-annual

Executed 2026-09-18 against RetireGolden base `39f8f460` (branch claude/b1-p4-cards-slice-nine) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualExpenseSummary.ts`

```diff
@@ -86,9 +86,7 @@ export function annualExpenseSummary(
     requiredSpending:
       requiredSpendingBase + input.skippedRequiredNominal,
     targetSpending:
-      targetSpendingBase +
-      input.skippedTargetNominal +
-      input.skippedRequiredNominal,
+      targetSpendingBase,
     idealSpending: idealSpendingBase + input.skippedIdealNominal,
     excessSpending: excessSpendingBase + input.skippedExcessNominal,
     intendedSpending:
```

This omits both skipped amounts, publishing $60,000 — the worksheet's second wrong reading. The intended fixture in the same file fails alongside.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualExpenseSummary.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/projection/internal/annualExpenseSummary.evidence.test.ts > spending-target-requested-annual — Annual target-layer requested spending > carries the full target layer and each skipped amount once: 62500
AssertionError: targetSpending 60000 is not within {"abs":0.005} of the worksheet's 62500: expected false to be true // Object.is equality
 FAIL  src/projection/internal/annualExpenseSummary.evidence.test.ts > spending-intended-annual — Annual intended spending with no guardrail cut > adds the target base and the two increments, each skipped goal once: 85250
AssertionError: targetSpending 70000 is not within {"abs":0.005} of the worksheet's 73000: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/internal/annualExpenseSummary.ts`, then `git diff --quiet -- packages/engine/src/projection/internal/annualExpenseSummary.ts` exited 0, confirming no change to production code after the run.
