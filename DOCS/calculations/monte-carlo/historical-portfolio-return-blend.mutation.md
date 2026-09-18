# Mutation receipt: historical-portfolio-return-blend

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/historicalReturns.ts`

```diff
--- a/packages/engine/src/montecarlo/historicalReturns.ts
+++ b/packages/engine/src/montecarlo/historicalReturns.ts
@@ mutation @@
-return year.stocksPct * w + year.bondsPct * (1 - w)
+return year.stocksPct * (1 - w) + year.bondsPct * w
```

Reverses the stock/bond weights, the worksheet's first wrong reading (18.0% instead of 26.6%).

## Command

```
npx vitest run src/montecarlo/historicalReturns.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1`; stdout precedes stderr, so the run summary appears before the failed-test detail. The `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-s3/packages/engine

 ❯ src/montecarlo/historicalReturns.evidence.test.ts (7 tests | 3 failed) 6ms
   ❯ historical-portfolio-mean — Arithmetic mean of blended historical portfolio returns (2)
     × the 60/40 arithmetic mean of the 96 blended years is 8.93729166666667% 3ms
   ❯ historical-portfolio-return-blend — One-year two-asset blended nominal return (2)
     × blends 1928 43.8/0.8 at 60% equity to 26.6% 0ms
     × the 1928 embedded row blends to the same 26.6% 0ms

 Test Files  1 failed (1)
      Tests  3 failed | 4 passed (7)

(node:45660) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:27108) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/historicalReturns.evidence.test.ts > historical-portfolio-mean — Arithmetic mean of blended historical portfolio returns > the 60/40 arithmetic mean of the 96 blended years is 8.93729166666667%
AssertionError: meanPct 7.578333333333334 is not within {"abs":1e-12} of the worksheet's 8.93729166666667: expected false to be true // Object.is equality

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

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  src/montecarlo/historicalReturns.evidence.test.ts > historical-portfolio-return-blend — One-year two-asset blended nominal return > blends 1928 43.8/0.8 at 60% equity to 26.6%
AssertionError: blendedPct 18 is not within {"abs":1e-12} of the worksheet's 26.6: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/historicalReturns.evidence.test.ts:152:9
    150|         withinTolerance(blendedPct, expected, example.tolerance),
    151|         `blendedPct ${blendedPct} is not within ${JSON.stringify(examp…
    152|       ).toBe(true)
       |         ^
    153|     })
    154|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  src/montecarlo/historicalReturns.evidence.test.ts > historical-portfolio-return-blend — One-year two-asset blended nominal return > the 1928 embedded row blends to the same 26.6%
AssertionError: embedded 1928 blend 18 is not within {"abs":1e-12} of the worksheet's 26.6: expected false to be true // Object.is equality

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

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
```

## Revert

`git checkout -- packages/engine/src/montecarlo/historicalReturns.ts`, then `git diff --quiet -- packages/engine/src/montecarlo/historicalReturns.ts` exited 0, confirming no change to production code after the run.
