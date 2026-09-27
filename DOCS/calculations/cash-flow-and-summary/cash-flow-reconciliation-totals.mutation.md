# Mutation receipt: cash-flow-reconciliation-totals

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-nine` at base `39f8f460`, and re-executed 2026-09-22 against RetireGolden base `4fe87f00` (branch `claude/b1-p4-cards-nine-ten`, pull request #729), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet) in `packages/engine`.

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

Re-executed for D-RECEIPT-DRIFT because the test counts it stated no longer matched the current test file; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (annualCashFlowReconciliation.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine9/packages/engine

 ❯ src/projection/annualCashFlowReconciliation.evidence.test.ts (8 tests | 3 failed) 9ms
   ❯ cash-flow-reconciliation-totals — Annual cash-flow reconciliation: the three identity totals (5)
     × accepts the 0.004 cash residual at the annual-funding tolerance and publishes the by-kind destination members 6ms
     × sums requested, funded and unfunded over the fourteen use lines, and the funded total is the destination total 1ms
   ❯ cash-flow-line-plan-dollars — Cash-flow line amounts and the annual cash identity (1)
     × closes the 80000 cash identity and leaves the 5000 post-solve deposit outside it 0ms

 Test Files  1 failed (1)
      Tests  3 failed | 5 passed (8)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

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

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

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

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  src/projection/annualCashFlowReconciliation.evidence.test.ts > cash-flow-line-plan-dollars — Cash-flow line amounts and the annual cash identity > closes the 80000 cash identity and leaves the 5000 post-solve deposit outside it
AssertionError: cash destination total 70000 is not within {"abs":0.005} of the worksheet's 80000: expected false to be true // Object.is equality

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
 ❯ src/projection/annualCashFlowReconciliation.evidence.test.ts:463:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/annualCashFlowReconciliation.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/annualCashFlowReconciliation.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
