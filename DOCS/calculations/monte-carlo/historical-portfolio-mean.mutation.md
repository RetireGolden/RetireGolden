# Mutation receipt: historical-portfolio-mean

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/historicalReturns.ts`

```diff
diff --git a/packages/engine/src/montecarlo/historicalReturns.ts b/packages/engine/src/montecarlo/historicalReturns.ts
index 9d4fc90d..2a7db4e0 100644
--- a/packages/engine/src/montecarlo/historicalReturns.ts
+++ b/packages/engine/src/montecarlo/historicalReturns.ts
@@ -132,5 +132,5 @@ export function portfolioReturnPct(year: HistoricalYear, equityWeightPct: number
 export function meanPortfolioReturnPct(equityWeightPct: number): number {
   let sum = 0
   for (const y of HISTORICAL_YEARS) sum += portfolioReturnPct(y, equityWeightPct)
-  return sum / HISTORICAL_YEARS.length
+  return sum / (HISTORICAL_YEARS.length - 1)
 }
```

Divides by 95 instead of 96, the worksheet's first wrong reading.

## Command

```
npx vitest run src/montecarlo/historicalReturns.evidence.test.ts
```

## Captured failing output

Re-executed for D-RECEIPT-DRIFT because its diff was a text substitution that named no line (it is now the git diff of the same substitution) and the test lines it quoted no longer matched the current test file; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (historicalReturns.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/montecarlo/historicalReturns.evidence.test.ts (7 tests | 1 failed) 6ms
   ❯ historical-portfolio-mean — Arithmetic mean of blended historical portfolio returns (2)
     × the 60/40 arithmetic mean of the 96 blended years is 8.93729166666667% 3ms

 Test Files  1 failed (1)
      Tests  1 failed | 6 passed (7)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/historicalReturns.evidence.test.ts > historical-portfolio-mean — Arithmetic mean of blended historical portfolio returns > the 60/40 arithmetic mean of the 96 blended years is 8.93729166666667%
AssertionError: meanPct 9.031368421052635 is not within {"abs":1e-12} of the worksheet's 8.93729166666667: expected false to be true // Object.is equality

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

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/historicalReturns.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/historicalReturns.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
