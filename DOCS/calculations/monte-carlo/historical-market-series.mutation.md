# Mutation receipt: historical-market-series

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/historicalReturns.ts`

```diff
--- a/packages/engine/src/montecarlo/historicalReturns.ts
+++ b/packages/engine/src/montecarlo/historicalReturns.ts
@@ mutation @@
-{ year: 1928, stocksPct: 43.8, bondsPct: 0.8, inflationPct: -1.2 },
+{ year: 1928, stocksPct: 43.9, bondsPct: 0.8, inflationPct: -1.2 },
```

Edits the stored 1928 stock return from 43.8 to 43.9, the kind of one-value transcription drift the sample-row pin exists to catch.

## Command

```
npx vitest run src/montecarlo/historicalReturns.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1`; stdout precedes stderr, so the run summary appears before the failed-test detail. The `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-s3/packages/engine

 ❯ src/montecarlo/historicalReturns.evidence.test.ts (7 tests | 4 failed) 6ms
   ❯ historical-market-series — Embedded annual stock, bond, and inflation series, 1928–2023 (3)
     × column sums are stocks 1118.9, bonds 466.6, inflation 298.8 percentage points 3ms
     × pins the 1928, 1929, and 2023 sample rows the worksheet names 0ms
   ❯ historical-portfolio-mean — Arithmetic mean of blended historical portfolio returns (2)
     × the 60/40 arithmetic mean of the 96 blended years is 8.93729166666667% 0ms
   ❯ historical-portfolio-return-blend — One-year two-asset blended nominal return (2)
     × the 1928 embedded row blends to the same 26.6% 0ms

 Test Files  1 failed (1)
      Tests  4 failed | 3 passed (7)

(node:13972) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:44112) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/historicalReturns.evidence.test.ts > historical-market-series — Embedded annual stock, bond, and inflation series, 1928–2023 > column sums are stocks 1118.9, bonds 466.6, inflation 298.8 percentage points
AssertionError: stockSumPct 1119 is not the worksheet's 1118.9: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/historicalReturns.evidence.test.ts:48:9
     46|         withinTolerance(stockSum, example.expected.stockSumPct as numb…
     47|         `stockSumPct ${stockSum} is not the worksheet's ${example.expe…
     48|       ).toBe(true)
       |         ^
     49|       expect(
     50|         withinTolerance(bondSum, example.expected.bondSumPct as number…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/4]⎯

 FAIL  src/montecarlo/historicalReturns.evidence.test.ts > historical-market-series — Embedded annual stock, bond, and inflation series, 1928–2023 > pins the 1928, 1929, and 2023 sample rows the worksheet names
AssertionError: 1928 stocksPct 43.9 is not the worksheet's 43.8: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/historicalReturns.evidence.test.ts:74:11
     72|           withinTolerance(row.stocksPct, expected.stocksPct, example.t…
     73|           `${label} stocksPct ${row.stocksPct} is not the worksheet's …
     74|         ).toBe(true)
       |           ^
     75|         expect(
     76|           withinTolerance(row.bondsPct, expected.bondsPct, example.tol…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/4]⎯

 FAIL  src/montecarlo/historicalReturns.evidence.test.ts > historical-portfolio-mean — Arithmetic mean of blended historical portfolio returns > the 60/40 arithmetic mean of the 96 blended years is 8.93729166666667%
AssertionError: meanPct 8.937916666666668 is not within {"abs":1e-12} of the worksheet's 8.93729166666667: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/historicalReturns.evidence.test.ts:108:9
    106|         withinTolerance(meanPct, expected, example.tolerance),
    107|         `meanPct ${meanPct} is not within ${JSON.stringify(example.tol…
    108|       ).toBe(true)
       |         ^
    109|     })
    110|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/4]⎯

 FAIL  src/montecarlo/historicalReturns.evidence.test.ts > historical-portfolio-return-blend — One-year two-asset blended nominal return > the 1928 embedded row blends to the same 26.6%
AssertionError: embedded 1928 blend 26.66 is not within {"abs":1e-12} of the worksheet's 26.6: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/historicalReturns.evidence.test.ts:163:9
    161|         withinTolerance(blendedPct, expected, example.tolerance),
    162|         `embedded 1928 blend ${blendedPct} is not within ${JSON.string…
    163|       ).toBe(true)
       |         ^
    164|     })
    165|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/4]⎯
```

## Revert

`git checkout -- packages/engine/src/montecarlo/historicalReturns.ts`, then `git diff --quiet -- packages/engine/src/montecarlo/historicalReturns.ts` exited 0, confirming no change to production code after the run.
