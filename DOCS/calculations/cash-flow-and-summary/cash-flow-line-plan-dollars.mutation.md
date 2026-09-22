# Mutation receipt: cash-flow-line-plan-dollars

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eleven` at base `60e47fd8`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730) in `packages/engine`.

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

Re-executed 2026-09-22 on the pull-request branch after the review of #730: the branch was renamed for the pull request, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (annualCashFlowReconciliation.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/annualCashFlowReconciliation.evidence.test.ts (8 tests | 1 failed) 8ms
   ❯ cash-flow-line-plan-dollars — Cash-flow line amounts and the annual cash identity (1)
     × closes the 80000 cash identity and leaves the 5000 post-solve deposit outside it 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 7 passed (8)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/annualCashFlowReconciliation.evidence.test.ts > cash-flow-line-plan-dollars — Cash-flow line amounts and the annual cash identity > closes the 80000 cash identity and leaves the 5000 post-solve deposit outside it
AssertionError: cash source total 85000 is not within {"abs":0.005} of the worksheet's 80000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/annualCashFlowReconciliation.evidence.test.ts:355:9
    353|         withinTolerance(actual, target, example.tolerance),
    354|         `${label} ${actual} is not within ${JSON.stringify(example.tol…
    355|       ).toBe(true)
       |         ^
    356|     }
    357|
 ❯ src/projection/annualCashFlowReconciliation.evidence.test.ts:462:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/annualCashFlowReconciliation.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/annualCashFlowReconciliation.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
