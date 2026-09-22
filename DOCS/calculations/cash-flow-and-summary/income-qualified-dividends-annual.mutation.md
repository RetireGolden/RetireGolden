# Mutation receipt: income-qualified-dividends-annual

Executed 2026-09-18 against RetireGolden base `39f8f460` (branch claude/b1-p4-cards-slice-nine) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/distributedTaxableYieldRows.ts`

```diff
@@ -117,7 +117,7 @@ export function distributedTaxableYieldRows(
     const interest = startBalance * (interestYieldPct / 100)
     const dividends = startBalance * (dividendYieldPct / 100)
     const exempt = startBalance * (taxExemptYieldPct / 100)
-    const qualified = dividends * Math.min(1, Math.max(0, account.qualifiedRatio ?? blendedYield?.qualifiedRatio ?? DEFAULT_QUALIFIED_DIVIDEND_RATIO))
+    const qualified = dividends * DEFAULT_QUALIFIED_DIVIDEND_RATIO
     const ordinaryDividends = dividends - qualified
     const taxableGross = interest + dividends
     const gross = taxableGross + exempt
```

This applies the 0.85 default despite the account's explicit 0.60 ratio, publishing $1,487.50 of qualified dividends — the worksheet's first wrong reading. The ordinary-dividend fixture in the same file fails alongside, because the two partition the same dividends.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/distributedTaxableYieldRows.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/projection/internal/distributedTaxableYieldRows.evidence.test.ts > income-qualified-dividends-annual — Annual qualified dividends distributed by a taxable account > applies the explicit 0.60 ratio to 1750 of dividends: 1050
AssertionError: qualifiedDividends 1487.5000000000002 is not within {"abs":0.005} of the worksheet's 1050: expected false to be true // Object.is equality
 FAIL  src/projection/internal/distributedTaxableYieldRows.evidence.test.ts > income-ordinary-dividends-annual — Annual ordinary dividends distributed by a taxable account > leaves 700 of 1750 dividends ordinary at an explicit 0.60 ratio
AssertionError: ordinaryDividends 262.5 is not within {"abs":0.005} of the worksheet's 700: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/internal/distributedTaxableYieldRows.ts`, then `git diff --quiet -- packages/engine/src/projection/internal/distributedTaxableYieldRows.ts` exited 0, confirming no change to production code after the run.
