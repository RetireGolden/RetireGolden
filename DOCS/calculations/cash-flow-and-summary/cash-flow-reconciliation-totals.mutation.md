# Mutation receipt: cash-flow-reconciliation-totals

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-nine` at base `39f8f460`, and re-executed 2026-09-22 against RetireGolden base `4fe87f00` (branch `claude/b1-p4-cards-nine-ten`, pull request #729) in `packages/engine`.

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

Re-executed 2026-09-22 on the pull-request branch after the review of #729: the branch was renamed for the pull request and several fixtures changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (annualCashFlowReconciliation.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

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

The original bytes of `packages/engine/src/projection/annualCashFlowReconciliation.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/annualCashFlowReconciliation.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
