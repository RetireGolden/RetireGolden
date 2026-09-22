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

Re-executed 2026-09-18 after the worksheet was re-derived on one consistent line set and its fixture rebuilt; the same mutation (surplus investment dropped from the destination total) now fails the by-kind member assertion as well. The baseline is green (annualCashFlowReconciliation.evidence.test.ts passes on unmodified production). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-s9/packages/engine

 ❯ src/projection/annualCashFlowReconciliation.evidence.test.ts (5 tests | 2 failed) 7ms
   ❯ cash-flow-reconciliation-totals — Annual cash-flow reconciliation: the three identity totals (5)
     × accepts the 0.004 cash residual at the annual-funding tolerance and publishes the by-kind destination members 5ms
     × sums requested, funded and unfunded over the fourteen use lines, and the funded total is the destination total 1ms

 Test Files  1 failed (1)
      Tests  2 failed | 3 passed (5)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/annualCashFlowReconciliation.evidence.test.ts > cash-flow-reconciliation-totals — Annual cash-flow reconciliation: the three identity totals > accepts the 0.004 cash residual at the annual-funding tolerance and publishes the by-kind destination members
AssertionError: cash destination total 90000 is not within {"abs":0.000001} of the worksheet's 100000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/annualCashFlowReconciliation.evidence.test.ts:116:9
    114|         withinTolerance(actual, target, example.tolerance),
    115|         `${label} ${actual} is not within ${JSON.stringify(example.tol…
    116|       ).toBe(true)
       |         ^
    117|     }
    118|
 ❯ src/projection/annualCashFlowReconciliation.evidence.test.ts:232:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/projection/annualCashFlowReconciliation.evidence.test.ts > cash-flow-reconciliation-totals — Annual cash-flow reconciliation: the three identity totals > sums requested, funded and unfunded over the fourteen use lines, and the funded total is the destination total
AssertionError: expected 100000 to be 90000 // Object.is equality

- Expected
+ Received

- 90000
+ 100000

 ❯ src/projection/annualCashFlowReconciliation.evidence.test.ts:283:49
    281|       // The same sum over the same lines: the first derivation's 90,0…
    282|       // sit beside a 100,000 destination total.
    283|       expect(result.uses.fundedUsesPlanDollars).toBe(result.cash.desti…
       |                                                 ^
    284|       expect(
    285|         withinTolerance(

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

`git checkout -- packages/engine/src/projection/annualCashFlowReconciliation.ts`, then `git diff --quiet -- packages/engine/src/projection/annualCashFlowReconciliation.ts` exited 0, confirming no change to production code after the run.
