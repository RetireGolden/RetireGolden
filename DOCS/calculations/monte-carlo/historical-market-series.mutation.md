# Mutation receipt: historical-market-series

Re-executed 2026-09-18 after the #719 review against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-10-08 against RetireGolden base `d22dc9d7` (branch `claude/engine-0.4.3`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/historicalReturns.ts`

```diff
diff --git a/packages/engine/src/montecarlo/historicalReturns.ts b/packages/engine/src/montecarlo/historicalReturns.ts
index 1857f9713..a7bcff4e0 100644
--- a/packages/engine/src/montecarlo/historicalReturns.ts
+++ b/packages/engine/src/montecarlo/historicalReturns.ts
@@ -25,7 +25,7 @@ export interface HistoricalYear {
 // [stocksPct, bondsPct, inflationPct], one row per year from FIRST_HISTORICAL_YEAR.
 // prettier-ignore
 const HISTORICAL_YEAR_ROWS: readonly (readonly [number, number, number])[] = [
-  [43.8, 0.8, -1.2],
+  [43.9, 0.8, -1.2],
   [-8.3, 4.2, 0.6],
   [-25.1, 4.5, -6.4],
   [-43.8, -2.6, -9.3],
```

Edits the stored 1928 stock return from 43.8 to 43.9, the kind of one-value transcription drift the sample-row pin exists to catch. A 0.1 change is well above the unrounded 1e-9 column-sum bound.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 npx.cmd vitest run src/montecarlo/historicalReturns.evidence.test.ts
```

## Captured failing output

Re-executed on 2026-10-08 because the table now ships as rows of three numbers decoded at load (D-BUNDLE-HEADROOM) and the hunk no longer anchored; the mutation is the same edit in the new form, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (historicalReturns.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/montecarlo/historicalReturns.evidence.test.ts (7 tests | 4 failed) 7ms
   ❯ historical-market-series — Embedded annual stock, bond, and inflation series, 1928–2023 (3)
     × column sums are stocks 1118.9, bonds 466.6, inflation 298.8 percentage points 3ms
     × pins the 1928, 1929, and 2023 sample rows the worksheet names 0ms
   ❯ historical-portfolio-mean — Arithmetic mean of blended historical portfolio returns (2)
     × the 60/40 arithmetic mean of the 96 blended years is 8.93729166666667% 0ms
   ❯ historical-portfolio-return-blend — One-year two-asset blended nominal return (2)
     × the 1928 embedded row blends to the same 26.6% 0ms

 Test Files  1 failed (1)
      Tests  4 failed | 3 passed (7)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/historicalReturns.evidence.test.ts > historical-market-series — Embedded annual stock, bond, and inflation series, 1928–2023 > column sums are stocks 1118.9, bonds 466.6, inflation 298.8 percentage points
AssertionError: stockSumPct 1118.9999999999998 is not within {"abs":1e-9} of the worksheet's 1118.9: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/historicalReturns.evidence.test.ts:46:9
     44|         withinTolerance(stockSum, example.expected.stockSumPct as numb…
     45|         `stockSumPct ${stockSum} is not within ${JSON.stringify(exampl…
     46|       ).toBe(true)
       |         ^
     47|       expect(
     48|         withinTolerance(bondSum, example.expected.bondSumPct as number…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/4]⎯

 FAIL  src/montecarlo/historicalReturns.evidence.test.ts > historical-market-series — Embedded annual stock, bond, and inflation series, 1928–2023 > pins the 1928, 1929, and 2023 sample rows the worksheet names
AssertionError: 1928 stocksPct 43.9 is not the worksheet's 43.8: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/historicalReturns.evidence.test.ts:72:11
     70|           withinTolerance(row.stocksPct, expected.stocksPct, example.t…
     71|           `${label} stocksPct ${row.stocksPct} is not the worksheet's …
     72|         ).toBe(true)
       |           ^
     73|         expect(
     74|           withinTolerance(row.bondsPct, expected.bondsPct, example.tol…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/4]⎯

 FAIL  src/montecarlo/historicalReturns.evidence.test.ts > historical-portfolio-mean — Arithmetic mean of blended historical portfolio returns > the 60/40 arithmetic mean of the 96 blended years is 8.93729166666667%
AssertionError: meanPct 8.937916666666668 is not within {"abs":1e-12} of the worksheet's 8.93729166666667: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/historicalReturns.evidence.test.ts:106:9
    104|         withinTolerance(meanPct, expected, example.tolerance),
    105|         `meanPct ${meanPct} is not within ${JSON.stringify(example.tol…
    106|       ).toBe(true)
       |         ^
    107|     })
    108|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/4]⎯

 FAIL  src/montecarlo/historicalReturns.evidence.test.ts > historical-portfolio-return-blend — One-year two-asset blended nominal return > the 1928 embedded row blends to the same 26.6%
AssertionError: embedded 1928 blend 26.66 is not within {"abs":1e-12} of the worksheet's 26.6: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/historicalReturns.evidence.test.ts:161:9
    159|         withinTolerance(blendedPct, expected, example.tolerance),
    160|         `embedded 1928 blend ${blendedPct} is not within ${JSON.string…
    161|       ).toBe(true)
       |         ^
    162|     })
    163|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/4]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/historicalReturns.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/historicalReturns.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
