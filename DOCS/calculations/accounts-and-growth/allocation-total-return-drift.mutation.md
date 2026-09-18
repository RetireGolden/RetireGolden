# Mutation receipt: allocation-total-return-drift

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch claude/b1-p4-cards-accounts-spending) in `packages/engine`.

## Mutation applied to `packages/engine/src/allocation/assetClasses.ts`

```diff
@@ -201,7 +201,7 @@ export function blendedTaxableYield(
 export function driftWeights(weights: number[], ratesPct: number[]): number[] {
   const grown = weights.map((w, i) => w * Math.max(0, 1 + (ratesPct[i] ?? 0) / 100))
   const total = grown.reduce((a, b) => a + b, 0)
-  return total > 0 ? grown.map((v) => v / total) : weights
+  return grown
 }
 
 /** Fraction of the account sold to move current → target (Σ overweight). Reads both, writes neither. */
```

This skips the renormalization, the worksheet's second wrong reading: the ending amounts [0.66, 0, 0.38, 0] are returned as weights, summing to 1.04, a 0.0254 miss on the first component (0.66 against 33/52) and a 0.04 miss on the sum against the 1e-12 tolerance.

## Command

```
npx vitest run src/allocation/assetClasses.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1`, stdout and stderr together; stdout precedes stderr, so the run summary appears before the failed-test detail. Blank lines, the `Start at` and `Duration` lines, and Vitest's transform-cache performance hint (when printed) are the only lines removed. The run exited 1.

```
 RUN  v5.0.0 C:/TEMP/rg-s5/packages/engine
 ❯ src/allocation/assetClasses.evidence.test.ts (32 tests | 2 failed) 10ms
   ❯ allocation-total-return-drift — Unrebalanced weights after one year of class returns (2)
     × drifts 60/40 to [33/52, 19/52] after +10% on stocks and -5% on bonds 4ms
     × the drifted weights are renormalized to sum 1 1ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/allocation/assetClasses.evidence.test.ts > allocation-total-return-drift — Unrebalanced weights after one year of class returns > drifts 60/40 to [33/52, 19/52] after +10% on stocks and -5% on bonds
AssertionError: driftedWeights[0] 0.66 is not within {"abs":1e-12} of the worksheet's 0.6346153846153846: expected false to be true // Object.is equality
- Expected
+ Received
- true
+ false
 ❯ src/allocation/assetClasses.evidence.test.ts:47:7
     45|       withinTolerance(actual[index]!, value, tolerance),
     46|       `${label}[${index}] ${actual[index]} is not within ${JSON.string…
     47|     ).toBe(true)
       |       ^
     48|   })
     49| }
 ❯ expectVector src/allocation/assetClasses.evidence.test.ts:43:12
 ❯ src/allocation/assetClasses.evidence.test.ts:445:7
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯
 FAIL  src/allocation/assetClasses.evidence.test.ts > allocation-total-return-drift — Unrebalanced weights after one year of class returns > the drifted weights are renormalized to sum 1
AssertionError: sum 1.04 is not within {"abs":1e-12} of the worksheet's 1: expected false to be true // Object.is equality
- Expected
+ Received
- true
+ false
 ❯ src/allocation/assetClasses.evidence.test.ts:454:9
    452|         withinTolerance(sum, expected, example.tolerance),
    453|         `sum ${sum} is not within ${JSON.stringify(example.tolerance)}…
    454|       ).toBe(true)
       |         ^
    455|     })
    456|   },
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
 Test Files  1 failed (1)
      Tests  2 failed | 30 passed (32)
```

## Revert

`git checkout -- packages/engine/src/allocation/assetClasses.ts`, then `git diff --quiet -- packages/engine/src/allocation/assetClasses.ts` exited 0, confirming no change to production code after the run.
