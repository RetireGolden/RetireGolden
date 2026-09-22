# Mutation receipt: exact-ledger-summary-comparison

Executed 2026-09-18 against RetireGolden base `2c07f0d7` (branch `claude/b1-p4-cards-slice-twelve`) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/optimizePlan.ts`

```diff
diff --git a/packages/engine/src/projection/optimizePlan.ts b/packages/engine/src/projection/optimizePlan.ts
index 7c76b855..15d7f4e8 100644
--- a/packages/engine/src/projection/optimizePlan.ts
+++ b/packages/engine/src/projection/optimizePlan.ts
@@ -2229,7 +2229,7 @@ function evaluateExactLedgerScheduleCalculation(
     baseline: evaluation.baselineSummary,
     candidate: evaluation.candidateSummary,
     afterTaxEstateDelta: evaluation.deltas.endingAfterTaxEstate,
-    endingNetWorthDelta: evaluation.deltas.endingNetWorth,
+    endingNetWorthDelta: evaluation.deltas.endingAfterTaxEstate,
     lifetimeTaxDelta: evaluation.deltas.lifetimeTax,
     moneyLastsYearsDelta: evaluation.deltas.moneyLastsYears,
     requestedConversionTotal: execution.requestedTotal,
```

Publish the after-tax-estate difference as the ending-net-worth delta — the worksheet's second wrong reading, `$535,500.25 − $500,000.00 = $35,500.25`.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/optimizePlan.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-s12/packages/engine

 ❯ src/projection/optimizePlan.evidence.test.ts (10 tests | 1 failed) 30ms
   ❯ exact-ledger-summary-comparison — Exact ledger summary comparison (1)
     × publishes 500000.00 and 535500.25 from their own results and 28250.50 of net worth 11ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/optimizePlan.evidence.test.ts > exact-ledger-summary-comparison — Exact ledger summary comparison > publishes 500000.00 and 535500.25 from their own results and 28250.50 of net worth
AssertionError: endingNetWorthDelta: actual 35500.25, worksheet 28250.5: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/optimizePlan.evidence.test.ts:230:9
    228|         withinTolerance(validation.endingNetWorthDelta, expectedDelta,…
    229|         `endingNetWorthDelta: actual ${validation.endingNetWorthDelta}…
    230|       ).toBe(true)
       |         ^
    231|       // The wrong readings the worksheet names: the reversed subtract…
    232|       // after-tax-estate difference standing in for the net-worth del…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed (1)
      Tests  1 failed | 9 passed (10)
```

## Revert

`git checkout -- packages/engine/src/projection/optimizePlan.ts` restored the file, and `git diff --quiet -- packages/engine/src/projection/optimizePlan.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the named file passed again (10 passed, exit 0).
