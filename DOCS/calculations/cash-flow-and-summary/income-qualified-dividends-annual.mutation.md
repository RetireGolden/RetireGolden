# Mutation receipt: income-qualified-dividends-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-nine` at base `39f8f460`, and re-executed 2026-09-22 against RetireGolden base `4fe87f00` (branch `claude/b1-p4-cards-nine-ten`, pull request #729) in `packages/engine`.

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

Re-executed 2026-09-22 on the pull-request branch after the review of #729: the branch was renamed for the pull request and several fixtures changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (distributedTaxableYieldRows.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/internal/distributedTaxableYieldRows.evidence.test.ts (9 tests | 2 failed) 58ms
   ❯ income-qualified-dividends-annual — Annual qualified dividends distributed by a taxable account (2)
     × applies the explicit 0.60 ratio to 1750 of dividends: 1050 7ms
   ❯ income-ordinary-dividends-annual — Annual ordinary dividends distributed by a taxable account (2)
     × leaves 700 of 1750 dividends ordinary at an explicit 0.60 ratio 3ms

 Test Files  1 failed (1)
      Tests  2 failed | 7 passed (9)

  Transform  transforming modules took 2.15s · 44% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/distributedTaxableYieldRows.evidence.test.ts > income-qualified-dividends-annual — Annual qualified dividends distributed by a taxable account > applies the explicit 0.60 ratio to 1750 of dividends: 1050
AssertionError: qualifiedDividends 1487.5000000000002 is not within {"abs":0.005} of the worksheet's 1050: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/distributedTaxableYieldRows.evidence.test.ts:110:5
    108|     withinTolerance(actual, target, tolerance),
    109|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
    110|   ).toBe(true)
       |     ^
    111| }
    112|
 ❯ src/projection/internal/distributedTaxableYieldRows.evidence.test.ts:168:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/projection/internal/distributedTaxableYieldRows.evidence.test.ts > income-ordinary-dividends-annual — Annual ordinary dividends distributed by a taxable account > leaves 700 of 1750 dividends ordinary at an explicit 0.60 ratio
AssertionError: ordinaryDividends 262.5 is not within {"abs":0.005} of the worksheet's 700: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/distributedTaxableYieldRows.evidence.test.ts:110:5
    108|     withinTolerance(actual, target, tolerance),
    109|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
    110|   ).toBe(true)
       |     ^
    111| }
    112|
 ❯ src/projection/internal/distributedTaxableYieldRows.evidence.test.ts:204:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/distributedTaxableYieldRows.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/distributedTaxableYieldRows.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
