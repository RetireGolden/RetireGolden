# Mutation receipt: income-taxable-interest-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-nine` at base `39f8f460`, and re-executed 2026-09-22 against RetireGolden base `4fe87f00` (branch `claude/b1-p4-cards-nine-ten`, pull request #729) in `packages/engine`.

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

Re-executed 2026-09-22 on the pull-request branch after the review of #729: the branch was renamed for the pull request and several fixtures changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (distributedTaxableYieldRows.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/internal/distributedTaxableYieldRows.evidence.test.ts (9 tests | 5 failed) 40ms
   ❯ income-taxable-interest-annual — Annual taxable interest distributed by a taxable account (2)
     × takes 2.25 percent of a 100000 start balance as 2250 of interest 28ms
     × still characterizes 1000 of interest when the yield is reinvested by default 2ms
   ❯ income-taxable-yield-annual — Annual taxable yield distributed by a taxable account (3)
     × adds 2250 of interest and 1750 of dividends to 4000 of taxable yield 1ms
     × adds 1000 of interest and 2000 of dividends to 3000 under the defaults 1ms
     × credits the reinvested 3000 back to the account and adds 0 to the year cash inflows 2ms

 Test Files  1 failed (1)
      Tests  5 failed | 4 passed (9)

  Transform  transforming modules took 2.17s · 44% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 5 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/distributedTaxableYieldRows.evidence.test.ts > income-taxable-interest-annual — Annual taxable interest distributed by a taxable account > takes 2.25 percent of a 100000 start balance as 2250 of interest
AssertionError: taxableInterest 1750.0000000000002 is not within {"abs":0.005} of the worksheet's 2250: expected false to be true // Object.is equality

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
 ❯ src/projection/internal/distributedTaxableYieldRows.evidence.test.ts:132:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/5]⎯

 FAIL  src/projection/internal/distributedTaxableYieldRows.evidence.test.ts > income-taxable-interest-annual — Annual taxable interest distributed by a taxable account > still characterizes 1000 of interest when the yield is reinvested by default
AssertionError: taxableInterest 2000 is not within {"abs":0.005} of the worksheet's 1000: expected false to be true // Object.is equality

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
 ❯ src/projection/internal/distributedTaxableYieldRows.evidence.test.ts:141:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/5]⎯

 FAIL  src/projection/internal/distributedTaxableYieldRows.evidence.test.ts > income-taxable-yield-annual — Annual taxable yield distributed by a taxable account > adds 2250 of interest and 1750 of dividends to 4000 of taxable yield
AssertionError: taxableYield 3500.0000000000005 is not within {"abs":0.005} of the worksheet's 4000: expected false to be true // Object.is equality

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
 ❯ src/projection/internal/distributedTaxableYieldRows.evidence.test.ts:251:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/5]⎯

 FAIL  src/projection/internal/distributedTaxableYieldRows.evidence.test.ts > income-taxable-yield-annual — Annual taxable yield distributed by a taxable account > adds 1000 of interest and 2000 of dividends to 3000 under the defaults
AssertionError: taxableYield 4000 is not within {"abs":0.005} of the worksheet's 3000: expected false to be true // Object.is equality

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
 ❯ src/projection/internal/distributedTaxableYieldRows.evidence.test.ts:268:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/5]⎯

 FAIL  src/projection/internal/distributedTaxableYieldRows.evidence.test.ts > income-taxable-yield-annual — Annual taxable yield distributed by a taxable account > credits the reinvested 3000 back to the account and adds 0 to the year cash inflows
AssertionError: defaults yield reinvested 4000 is not within {"abs":0.005} of the worksheet's 3000: expected false to be true // Object.is equality

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
 ❯ src/projection/internal/distributedTaxableYieldRows.evidence.test.ts:279:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/5]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/distributedTaxableYieldRows.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/distributedTaxableYieldRows.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
