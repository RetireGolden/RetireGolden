# Mutation receipt: cash-flow-reconciliation-totals

Executed 2026-09-18 against RetireGolden base `39f8f460` (branch claude/b1-p4-cards-slice-nine) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/annualCashFlowReconciliation.ts`

```diff
@@ -167,8 +167,7 @@ function cashIdentity(
     fundedHouseholdUsesPlanDollars +
     settledTaxPlanDollars +
     penaltiesPlanDollars +
-    contributionsPlanDollars +
-    surplusInvestmentPlanDollars
+    contributionsPlanDollars
   return {
     spendableSourcesPlanDollars,
     portfolioFundingPlanDollars,
```

This omits surplus investment from the cash destination total, publishing $90,000 — the worksheet's second wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/annualCashFlowReconciliation.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/projection/annualCashFlowReconciliation.evidence.test.ts > cash-flow-reconciliation-totals — Annual cash-flow reconciliation: the three identity totals > accepts a 0.004 cash residual at the annual funding tolerance
AssertionError: cash destination total 90000 is not within {"abs":0.000001} of the worksheet's 100000: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/annualCashFlowReconciliation.ts`, then `git diff --quiet -- packages/engine/src/projection/annualCashFlowReconciliation.ts` exited 0, confirming no change to production code after the run.
