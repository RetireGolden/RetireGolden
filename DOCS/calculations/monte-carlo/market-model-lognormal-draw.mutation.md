# Mutation receipt: market-model-lognormal-draw

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/marketModels.ts`

```diff
--- a/packages/engine/src/montecarlo/marketModels.ts
+++ b/packages/engine/src/montecarlo/marketModels.ts
@@ mutation @@
-        // E[exp(σz − σ²/2)] = 1: shocks average out to the expected return.
-        returnShockPct[i] = (Math.exp(sigma * z1 - (sigma * sigma) / 2) - 1) * 100
+        // E[exp(σz − σ²/2)] = 1: shocks average out to the expected return.
+        returnShockPct[i] = (Math.exp(sigma * z1 - (sigma * sigma) / 2) - 1) * 100 + 100
```

Adds 100 so a zero-vol path emits 100 rather than shock 0, the worksheet's first wrong reading (returning the gross multiplier as percent).

## Command

```
npx vitest run src/montecarlo/marketModels.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1`; stdout precedes stderr, so the run summary appears before the failed-test detail. The `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-s3/packages/engine

 ❯ src/montecarlo/marketModels.evidence.test.ts (13 tests | 5 failed) 9ms
   ❯ market-model-empirical-history — Empirical historical shock, centered or raw (1)
     × centered shock 2 and raw shock 10; ledger returns 8% and 16% 4ms
   ❯ market-model-garch-variance — GARCH(1,1) variance recursion (1)
     × GARCH(1,1) next variance is 4.6 at the worksheet prior 1ms
   ❯ market-model-historical-centered-bootstrap — Centered historical bootstrap shock (1)
     × 1928 at 60% equity with supplied mean 8 is shock 18.6 and inflation −1.2% 0ms
   ❯ market-model-lognormal-draw — Mean-preserving lognormal return shock (1)
     × zero return vol and inflation 3/0 yields shock 0 and inflation 3% every year 0ms
   ❯ market-model-reversed-history — Reversed-history window replay (1)
     × reverses [2000, 2001, 2002] to [2002, 2001, 2000] 1ms

 Test Files  1 failed (1)
      Tests  5 failed | 8 passed (13)

(node:11952) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:5844) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 5 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/marketModels.evidence.test.ts > market-model-empirical-history — Empirical historical shock, centered or raw > centered shock 2 and raw shock 10; ledger returns 8% and 16%
AssertionError: expected 17.662708333333327 to be 2 // Object.is equality

- Expected
+ Received

- 2
+ 17.662708333333327

 ❯ src/montecarlo/marketModels.evidence.test.ts:161:42
    159|       const expectedCentered = example.expected.centeredShockPct as nu…
    160|       const expectedRaw = example.expected.rawShockPct as number
    161|       expect(centered.returnShockPct[0]).toBe(expectedCentered)
       |                                          ^
    162|       expect(raw.returnShockPct[0]).toBe(expectedRaw)
    163|       expect(planExpected + centered.returnShockPct[0]!).toBe(example.…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/5]⎯

 FAIL  src/montecarlo/marketModels.evidence.test.ts > market-model-garch-variance — GARCH(1,1) variance recursion > GARCH(1,1) next variance is 4.6 at the worksheet prior
AssertionError: nextVariance 1.0000799999999999 is not within {"abs":1e-12} of the worksheet's 4.6: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/marketModels.evidence.test.ts:210:9
    208|         withinTolerance(nextVariance, expected, example.tolerance),
    209|         `nextVariance ${nextVariance} is not within ${JSON.stringify(e…
    210|       ).toBe(true)
       |         ^
    211|     })
    212|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/5]⎯

 FAIL  src/montecarlo/marketModels.evidence.test.ts > market-model-historical-centered-bootstrap — Centered historical bootstrap shock > 1928 at 60% equity with supplied mean 8 is shock 18.6 and inflation −1.2%
AssertionError: returnShockPct 17.662708333333327 is not within {"abs":1e-12} of the worksheet's 18.6: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/marketModels.evidence.test.ts:268:9
    266|         withinTolerance(shock, expectedShock, example.tolerance),
    267|         `returnShockPct ${shock} is not within ${JSON.stringify(exampl…
    268|       ).toBe(true)
       |         ^
    269|       expect(
    270|         withinTolerance(inflation, expectedInflation, example.toleranc…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/5]⎯

 FAIL  src/montecarlo/marketModels.evidence.test.ts > market-model-lognormal-draw — Mean-preserving lognormal return shock > zero return vol and inflation 3/0 yields shock 0 and inflation 3% every year
AssertionError: expected 100 to be +0 // Object.is equality

- Expected
+ Received

- 0
+ 100

 ❯ src/montecarlo/marketModels.evidence.test.ts:325:62
    323|       })
    324|       const path = seriesOf(model.generatePath(scriptedRng({ normals: …
    325|       for (const shock of path.returnShockPct) expect(shock).toBe(exam…
       |                                                              ^
    326|       for (const inflation of path.inflationPct) expect(inflation).toB…
    327|     })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/5]⎯

 FAIL  src/montecarlo/marketModels.evidence.test.ts > market-model-reversed-history — Reversed-history window replay > reverses [2000, 2001, 2002] to [2002, 2001, 2000]
AssertionError: expected 3.3 to be 2.4 // Object.is equality

- Expected
+ Received

- 2.4
+ 3.3

 ❯ src/montecarlo/marketModels.evidence.test.ts:401:42
    399|         const year = expectedYears[index]!
    400|         const row = HISTORICAL_YEARS.find((entry) => entry.year === ye…
    401|         expect(path.inflationPct[index]).toBe(row.inflationPct)
       |                                          ^
    402|         expect(
    403|           withinTolerance(shock, portfolioReturnPct(row, equityWeightP…
 ❯ src/montecarlo/marketModels.evidence.test.ts:398:27

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/5]⎯
```

## Revert

`git checkout -- packages/engine/src/montecarlo/marketModels.ts`, then `git diff --quiet -- packages/engine/src/montecarlo/marketModels.ts` exited 0, confirming no change to production code after the run.
