# Mutation receipt: cash-flow-tax-character-amount

Executed 2026-09-18 against RetireGolden base `60e47fd8` (branch claude/b1-p4-cards-slice-eleven) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/annualCashFlowReconciliation.ts`

```diff
@@ -140,7 +140,7 @@
   let loanProceedsPlanDollars = 0
   for (const line of sourceLines) {
     if (line.role === 'spendableSource') spendableSourcesPlanDollars += line.amountPlanDollars
-    else if (line.role === 'portfolioFunding') portfolioFundingPlanDollars += line.amountPlanDollars
+    else if (line.role === 'portfolioFunding') portfolioFundingPlanDollars += line.amountPlanDollars + (line.taxCharacter?.[0]?.amountPlanDollars ?? 0)
     else if (line.role === 'loanProceeds') loanProceedsPlanDollars += line.amountPlanDollars
   }
   let fundedHouseholdUsesPlanDollars = 0
```

This adds an attached tax-character amount to the physical source, publishing a false $150,000 source total — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/annualCashFlowReconciliation.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/projection/annualCashFlowReconciliation.evidence.test.ts > cash-flow-tax-character-amount — Cash-flow tax-character amount > annotates the 100000 withdrawal with 30000 of gain and still totals 120000 of cash
AssertionError: cash source total 150000 is not within {"abs":0.005} of the worksheet's 120000: expected false to be true // Object.is equality
 FAIL  src/projection/annualCashFlowReconciliation.evidence.test.ts > cash-flow-tax-character-amount — Cash-flow tax-character amount > accepts a negative capital-gain character and still counts it as no cash
AssertionError: cash source total with a loss 90000 is not within {"abs":0.005} of the worksheet's 120000: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/annualCashFlowReconciliation.ts`, then `git diff --quiet -- packages/engine/src/projection/annualCashFlowReconciliation.ts` exited 0, confirming no change to production code after the run.
