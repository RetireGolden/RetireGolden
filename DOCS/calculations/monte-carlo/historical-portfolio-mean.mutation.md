# Mutation receipt: historical-portfolio-mean

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/historicalReturns.ts`

```diff
--- a/packages/engine/src/montecarlo/historicalReturns.ts
+++ b/packages/engine/src/montecarlo/historicalReturns.ts
@@ mutation @@
-return sum / HISTORICAL_YEARS.length
+return sum / (HISTORICAL_YEARS.length - 1)
```

Divides by 95 instead of 96, the worksheet's first wrong reading.

## Command

```
npx vitest run src/montecarlo/historicalReturns.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1`; stdout precedes stderr, so the run summary appears before the failed-test detail. The `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-s3/packages/engine

 ❯ src/montecarlo/historicalReturns.evidence.test.ts (7 tests | 1 failed) 6ms
   ❯ historical-portfolio-mean — Arithmetic mean of blended historical portfolio returns (2)
     × the 60/40 arithmetic mean of the 96 blended years is 8.93729166666667% 3ms

 Test Files  1 failed (1)
      Tests  1 failed | 6 passed (7)

(node:37236) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:8428) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/historicalReturns.evidence.test.ts > historical-portfolio-mean — Arithmetic mean of blended historical portfolio returns > the 60/40 arithmetic mean of the 96 blended years is 8.93729166666667%
AssertionError: meanPct 9.031368421052635 is not within {"abs":1e-12} of the worksheet's 8.93729166666667: expected false to be true // Object.is equality

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

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

`git checkout -- packages/engine/src/montecarlo/historicalReturns.ts`, then `git diff --quiet -- packages/engine/src/montecarlo/historicalReturns.ts` exited 0, confirming no change to production code after the run.
