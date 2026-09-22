# Mutation receipt: spending-intended-annual

Executed 2026-09-18 against RetireGolden base `39f8f460` (branch claude/b1-p4-cards-slice-nine) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualExpenseSummary.ts`

```diff
@@ -94,11 +94,7 @@ export function annualExpenseSummary(
     intendedSpending:
       targetSpendingBase +
       idealSpendingBase +
-      excessSpendingBase +
-      input.skippedTargetNominal +
-      input.skippedRequiredNominal +
-      input.skippedIdealNominal +
-      input.skippedExcessNominal,
+      excessSpendingBase,
     guardrailFactor: input.discretionaryMultiplier,
     total:
       baseSpending +
```

This drops all four skipped-goal amounts, publishing $81,500 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualExpenseSummary.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/projection/internal/annualExpenseSummary.evidence.test.ts > spending-intended-annual — Annual intended spending with no guardrail cut > adds the target base and the two increments, each skipped goal once: 85250
AssertionError: intendedSpending 81500 is not within {"abs":0.005} of the worksheet's 85250: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/internal/annualExpenseSummary.ts`, then `git diff --quiet -- packages/engine/src/projection/internal/annualExpenseSummary.ts` exited 0, confirming no change to production code after the run.
