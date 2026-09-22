# Mutation receipt: cash-flow-line-plan-dollars

Executed 2026-09-18 against RetireGolden base `60e47fd8` (branch claude/b1-p4-cards-slice-eleven) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/annualCashFlowReconciliation.ts`

```diff
@@ -139,7 +139,7 @@
   let portfolioFundingPlanDollars = 0
   let loanProceedsPlanDollars = 0
   for (const line of sourceLines) {
-    if (line.role === 'spendableSource') spendableSourcesPlanDollars += line.amountPlanDollars
+    if (line.role === 'spendableSource' || line.role === 'postSolveDeposit') spendableSourcesPlanDollars += line.amountPlanDollars
     else if (line.role === 'portfolioFunding') portfolioFundingPlanDollars += line.amountPlanDollars
     else if (line.role === 'loanProceeds') loanProceedsPlanDollars += line.amountPlanDollars
   }
```

This counts the post-solve life-insurance deposit as a spendable source, publishing an $85,000 source total and a false $5,000 difference — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/annualCashFlowReconciliation.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/projection/annualCashFlowReconciliation.evidence.test.ts > cash-flow-line-plan-dollars — Cash-flow line amounts and the annual cash identity > closes the 80000 cash identity and leaves the 5000 post-solve deposit outside it
AssertionError: cash source total 85000 is not within {"abs":0.005} of the worksheet's 80000: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/annualCashFlowReconciliation.ts`, then `git diff --quiet -- packages/engine/src/projection/annualCashFlowReconciliation.ts` exited 0, confirming no change to production code after the run.
