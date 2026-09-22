# Mutation receipt: income-ordinary-dividends-annual

Executed 2026-09-18 against RetireGolden base `39f8f460` (branch claude/b1-p4-cards-slice-nine) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/distributedTaxableYieldRows.ts`

```diff
@@ -118,7 +118,7 @@ export function distributedTaxableYieldRows(
     const dividends = startBalance * (dividendYieldPct / 100)
     const exempt = startBalance * (taxExemptYieldPct / 100)
     const qualified = dividends * Math.min(1, Math.max(0, account.qualifiedRatio ?? blendedYield?.qualifiedRatio ?? DEFAULT_QUALIFIED_DIVIDEND_RATIO))
-    const ordinaryDividends = dividends - qualified
+    const ordinaryDividends = dividends
     const taxableGross = interest + dividends
     const gross = taxableGross + exempt
     const reinvest = account.reinvestDividends ?? true
```

This treats every dividend as ordinary, publishing $1,750 in the explicit case — the worksheet's first wrong reading. The taxable-yield fixture's partition check in the same file fails alongside.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/distributedTaxableYieldRows.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/projection/internal/distributedTaxableYieldRows.evidence.test.ts > income-ordinary-dividends-annual — Annual ordinary dividends distributed by a taxable account > leaves 700 of 1750 dividends ordinary at an explicit 0.60 ratio
AssertionError: ordinaryDividends 1750.0000000000002 is not within {"abs":0.005} of the worksheet's 700: expected false to be true // Object.is equality
 FAIL  src/projection/internal/distributedTaxableYieldRows.evidence.test.ts > income-ordinary-dividends-annual — Annual ordinary dividends distributed by a taxable account > leaves 300 of 2000 dividends ordinary under the 0.85 fallback
AssertionError: ordinaryDividends 2000 is not within {"abs":0.005} of the worksheet's 300: expected false to be true // Object.is equality
 FAIL  src/projection/internal/distributedTaxableYieldRows.evidence.test.ts > income-taxable-yield-annual — Annual taxable yield distributed by a taxable account > adds 2250 of interest and 1750 of dividends to 4000 of taxable yield
AssertionError: interest plus the dividend partition 5050 is not within {"abs":0.005} of the worksheet's 4000: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/internal/distributedTaxableYieldRows.ts`, then `git diff --quiet -- packages/engine/src/projection/internal/distributedTaxableYieldRows.ts` exited 0, confirming no change to production code after the run.
