# Mutation receipt: income-taxable-interest-annual

Executed 2026-09-18 against RetireGolden base `39f8f460` (branch claude/b1-p4-cards-slice-nine) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/distributedTaxableYieldRows.ts`

```diff
@@ -114,7 +114,7 @@ export function distributedTaxableYieldRows(
       continue
     }
 
-    const interest = startBalance * (interestYieldPct / 100)
+    const interest = startBalance * (dividendYieldPct / 100)
     const dividends = startBalance * (dividendYieldPct / 100)
     const exempt = startBalance * (taxExemptYieldPct / 100)
     const qualified = dividends * Math.min(1, Math.max(0, account.qualifiedRatio ?? blendedYield?.qualifiedRatio ?? DEFAULT_QUALIFIED_DIVIDEND_RATIO))
```

This applies the dividend rate where the interest rate belongs, publishing $1,750 of interest in the explicit case — the worksheet's first wrong reading. It also moves taxable yield, whose fixture is in the same file and fails alongside.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/distributedTaxableYieldRows.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/projection/internal/distributedTaxableYieldRows.evidence.test.ts > income-taxable-interest-annual — Annual taxable interest distributed by a taxable account > takes 2.25 percent of a 100000 start balance as 2250 of interest
AssertionError: taxableInterest 1750.0000000000002 is not within {"abs":0.005} of the worksheet's 2250: expected false to be true // Object.is equality
 FAIL  src/projection/internal/distributedTaxableYieldRows.evidence.test.ts > income-taxable-interest-annual — Annual taxable interest distributed by a taxable account > still characterizes 1000 of interest when the yield is reinvested by default
AssertionError: taxableInterest 2000 is not within {"abs":0.005} of the worksheet's 1000: expected false to be true // Object.is equality
 FAIL  src/projection/internal/distributedTaxableYieldRows.evidence.test.ts > income-taxable-yield-annual — Annual taxable yield distributed by a taxable account > adds 2250 of interest and 1750 of dividends to 4000 of taxable yield
AssertionError: taxableYield 3500.0000000000005 is not within {"abs":0.005} of the worksheet's 4000: expected false to be true // Object.is equality
 FAIL  src/projection/internal/distributedTaxableYieldRows.evidence.test.ts > income-taxable-yield-annual — Annual taxable yield distributed by a taxable account > adds 1000 of interest and 2000 of dividends to 3000 under the defaults
AssertionError: taxableYield 4000 is not within {"abs":0.005} of the worksheet's 3000: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/internal/distributedTaxableYieldRows.ts`, then `git diff --quiet -- packages/engine/src/projection/internal/distributedTaxableYieldRows.ts` exited 0, confirming no change to production code after the run.
