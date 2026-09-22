# Mutation receipt: income-taxable-yield-annual

Executed 2026-09-18 against RetireGolden base `39f8f460` (branch claude/b1-p4-cards-slice-nine) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/distributedTaxableYieldRows.ts`

```diff
@@ -119,7 +119,7 @@ export function distributedTaxableYieldRows(
     const exempt = startBalance * (taxExemptYieldPct / 100)
     const qualified = dividends * Math.min(1, Math.max(0, account.qualifiedRatio ?? blendedYield?.qualifiedRatio ?? DEFAULT_QUALIFIED_DIVIDEND_RATIO))
     const ordinaryDividends = dividends - qualified
-    const taxableGross = interest + dividends
+    const taxableGross = interest + dividends + qualified + ordinaryDividends
     const gross = taxableGross + exempt
     const reinvest = account.reinvestDividends ?? true
     const record: RecordedDistributedYield = {
```

This adds the dividend partition on top of the dividends it partitions, publishing $5,750 in the explicit case — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/distributedTaxableYieldRows.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/projection/internal/distributedTaxableYieldRows.evidence.test.ts > income-taxable-yield-annual — Annual taxable yield distributed by a taxable account > adds 2250 of interest and 1750 of dividends to 4000 of taxable yield
AssertionError: taxableYield 5750 is not within {"abs":0.005} of the worksheet's 4000: expected false to be true // Object.is equality
 FAIL  src/projection/internal/distributedTaxableYieldRows.evidence.test.ts > income-taxable-yield-annual — Annual taxable yield distributed by a taxable account > adds 1000 of interest and 2000 of dividends to 3000 under the defaults
AssertionError: taxableYield 5000 is not within {"abs":0.005} of the worksheet's 3000: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/internal/distributedTaxableYieldRows.ts`, then `git diff --quiet -- packages/engine/src/projection/internal/distributedTaxableYieldRows.ts` exited 0, confirming no change to production code after the run.
