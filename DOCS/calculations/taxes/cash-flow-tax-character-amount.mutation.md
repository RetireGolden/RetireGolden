# Mutation receipt: cash-flow-tax-character-amount

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eleven` at base `60e47fd8`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730) in `packages/engine`.

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

Re-executed 2026-09-22 on the pull-request branch after the review of #730: the branch was renamed for the pull request, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (annualCashFlowReconciliation.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/annualCashFlowReconciliation.evidence.test.ts (8 tests | 2 failed) 8ms
   ❯ cash-flow-tax-character-amount — Cash-flow tax-character amount (2)
     × annotates the 100000 withdrawal with 30000 of gain and still totals 120000 of cash 4ms
     × accepts a negative capital-gain character and still counts it as no cash 0ms

 Test Files  1 failed (1)
      Tests  2 failed | 6 passed (8)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/annualCashFlowReconciliation.evidence.test.ts > cash-flow-tax-character-amount — Cash-flow tax-character amount > annotates the 100000 withdrawal with 30000 of gain and still totals 120000 of cash
AssertionError: cash source total 150000 is not within {"abs":0.005} of the worksheet's 120000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/annualCashFlowReconciliation.evidence.test.ts:522:9
    520|         withinTolerance(actual, target, example.tolerance),
    521|         `${label} ${actual} is not within ${JSON.stringify(example.tol…
    522|       ).toBe(true)
       |         ^
    523|     }
    524|
 ❯ src/projection/annualCashFlowReconciliation.evidence.test.ts:571:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/projection/annualCashFlowReconciliation.evidence.test.ts > cash-flow-tax-character-amount — Cash-flow tax-character amount > accepts a negative capital-gain character and still counts it as no cash
AssertionError: cash source total with a loss 90000 is not within {"abs":0.005} of the worksheet's 120000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/annualCashFlowReconciliation.evidence.test.ts:522:9
    520|         withinTolerance(actual, target, example.tolerance),
    521|         `${label} ${actual} is not within ${JSON.stringify(example.tol…
    522|       ).toBe(true)
       |         ^
    523|     }
    524|
 ❯ src/projection/annualCashFlowReconciliation.evidence.test.ts:588:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/annualCashFlowReconciliation.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/annualCashFlowReconciliation.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
