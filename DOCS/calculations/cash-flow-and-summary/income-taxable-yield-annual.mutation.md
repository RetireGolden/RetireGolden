# Mutation receipt: income-taxable-yield-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-nine` at base `39f8f460`, and re-executed 2026-09-22 against RetireGolden base `4fe87f00` (branch `claude/b1-p4-cards-nine-ten`, pull request #729) in `packages/engine`.

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

Re-executed 2026-09-22 on the pull-request branch after the review of #729: the branch was renamed for the pull request and several fixtures changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (distributedTaxableYieldRows.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/internal/distributedTaxableYieldRows.evidence.test.ts (9 tests | 3 failed) 43ms
   ❯ income-taxable-yield-annual — Annual taxable yield distributed by a taxable account (3)
     × adds 2250 of interest and 1750 of dividends to 4000 of taxable yield 5ms
     × adds 1000 of interest and 2000 of dividends to 3000 under the defaults 2ms
     × credits the reinvested 3000 back to the account and adds 0 to the year cash inflows 2ms

 Test Files  1 failed (1)
      Tests  3 failed | 6 passed (9)

  Transform  transforming modules took 2.17s · 43% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/distributedTaxableYieldRows.evidence.test.ts > income-taxable-yield-annual — Annual taxable yield distributed by a taxable account > adds 2250 of interest and 1750 of dividends to 4000 of taxable yield
AssertionError: taxableYield 5750 is not within {"abs":0.005} of the worksheet's 4000: expected false to be true // Object.is equality

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

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  src/projection/internal/distributedTaxableYieldRows.evidence.test.ts > income-taxable-yield-annual — Annual taxable yield distributed by a taxable account > adds 1000 of interest and 2000 of dividends to 3000 under the defaults
AssertionError: taxableYield 5000 is not within {"abs":0.005} of the worksheet's 3000: expected false to be true // Object.is equality

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

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  src/projection/internal/distributedTaxableYieldRows.evidence.test.ts > income-taxable-yield-annual — Annual taxable yield distributed by a taxable account > credits the reinvested 3000 back to the account and adds 0 to the year cash inflows
AssertionError: defaults yield reinvested 5000 is not within {"abs":0.005} of the worksheet's 3000: expected false to be true // Object.is equality

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

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/distributedTaxableYieldRows.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/distributedTaxableYieldRows.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
