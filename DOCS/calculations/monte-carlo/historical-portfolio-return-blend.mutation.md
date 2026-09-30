# Mutation receipt: historical-portfolio-return-blend

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/historicalReturns.ts`

```diff
diff --git a/packages/engine/src/montecarlo/historicalReturns.ts b/packages/engine/src/montecarlo/historicalReturns.ts
index 9d4fc90d..726c0ae2 100644
--- a/packages/engine/src/montecarlo/historicalReturns.ts
+++ b/packages/engine/src/montecarlo/historicalReturns.ts
@@ -125,7 +125,7 @@ export const HISTORICAL_YEARS: readonly HistoricalYear[] = [
 /** Blended nominal portfolio return for one historical year. */
 export function portfolioReturnPct(year: HistoricalYear, equityWeightPct: number): number {
   const w = equityWeightPct / 100
-  return year.stocksPct * w + year.bondsPct * (1 - w)
+  return year.stocksPct * (1 - w) + year.bondsPct * w
 }
 
 /** Mean blended return across the dataset (centers bootstrap shocks at zero). */
```

Reverses the stock/bond weights, the worksheet's first wrong reading (18.0% instead of 26.6%).

## Command

```
npx vitest run src/montecarlo/historicalReturns.evidence.test.ts
```

## Captured failing output

Re-executed for D-RECEIPT-DRIFT because its diff was a text substitution that named no line (it is now the git diff of the same substitution) and the test lines it quoted no longer matched the current test file; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (historicalReturns.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/montecarlo/historicalReturns.evidence.test.ts (7 tests | 3 failed) 7ms
   ❯ historical-portfolio-mean — Arithmetic mean of blended historical portfolio returns (2)
     × the 60/40 arithmetic mean of the 96 blended years is 8.93729166666667% 3ms
   ❯ historical-portfolio-return-blend — One-year two-asset blended nominal return (2)
     × blends 1928 43.8/0.8 at 60% equity to 26.6% 0ms
     × the 1928 embedded row blends to the same 26.6% 0ms

 Test Files  1 failed (1)
      Tests  3 failed | 4 passed (7)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/historicalReturns.evidence.test.ts > historical-portfolio-mean — Arithmetic mean of blended historical portfolio returns > the 60/40 arithmetic mean of the 96 blended years is 8.93729166666667%
AssertionError: meanPct 7.578333333333334 is not within {"abs":1e-12} of the worksheet's 8.93729166666667: expected false to be true // Object.is equality

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

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  src/montecarlo/historicalReturns.evidence.test.ts > historical-portfolio-return-blend — One-year two-asset blended nominal return > blends 1928 43.8/0.8 at 60% equity to 26.6%
AssertionError: blendedPct 18 is not within {"abs":1e-12} of the worksheet's 26.6: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/historicalReturns.evidence.test.ts:150:9
    148|         withinTolerance(blendedPct, expected, example.tolerance),
    149|         `blendedPct ${blendedPct} is not within ${JSON.stringify(examp…
    150|       ).toBe(true)
       |         ^
    151|     })
    152|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  src/montecarlo/historicalReturns.evidence.test.ts > historical-portfolio-return-blend — One-year two-asset blended nominal return > the 1928 embedded row blends to the same 26.6%
AssertionError: embedded 1928 blend 18 is not within {"abs":1e-12} of the worksheet's 26.6: expected false to be true // Object.is equality

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

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/historicalReturns.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/historicalReturns.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
