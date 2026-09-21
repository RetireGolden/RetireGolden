# Mutation receipt: allocation-cholesky-factor

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo) in `packages/engine`.

## Mutation applied to `packages/engine/src/allocation/assetClasses.ts`

```diff
--- a/packages/engine/src/allocation/assetClasses.ts
+++ b/packages/engine/src/allocation/assetClasses.ts
@@ mutation @@
-L[i]![j] = Math.sqrt(Math.max(1e-12, matrix[i]![i]! - sum))
+L[i]![j] = Math.sqrt(Math.max(1e-12, matrix[i]![i]! - 2 * sum))
```

Doubles the subtracted inner-product on the diagonal, so L22 is sqrt(1-0.5)=0.707 rather than sqrt(3)/2. That is the worksheet's first wrong reading (1-r under the square root).

## Command

```
npx vitest run src/allocation/assetClasses.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1`; stdout precedes stderr, so the run summary appears before the failed-test detail. The `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-s3/packages/engine

 ❯ src/allocation/assetClasses.evidence.test.ts (2 tests | 2 failed) 5ms
   ❯ allocation-cholesky-factor — Cholesky factor of a correlation matrix (2)
     × factors [[1, 0.5], [0.5, 1]] as [[1, 0], [0.5, sqrt(3)/2]] 4ms
     × the factor reconstructs the off-diagonal 0.5 and the unit diagonal 0ms

 Test Files  1 failed (1)
      Tests  2 failed (2)

(node:16460) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:8164) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/allocation/assetClasses.evidence.test.ts > allocation-cholesky-factor — Cholesky factor of a correlation matrix > factors [[1, 0.5], [0.5, 1]] as [[1, 0], [0.5, sqrt(3)/2]]
AssertionError: L[1][1] 0.7071067811865476 is not within {"abs":1e-12} of the worksheet's 0.866025403784439: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/allocation/assetClasses.evidence.test.ts:29:13
     27|             withinTolerance(L[i]![j]!, value, example.tolerance),
     28|             `L[${i}][${j}] ${L[i]![j]} is not within ${JSON.stringify(…
     29|           ).toBe(true)
       |             ^
     30|         })
     31|       })
 ❯ src/allocation/assetClasses.evidence.test.ts:25:13
 ❯ src/allocation/assetClasses.evidence.test.ts:23:16

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/allocation/assetClasses.evidence.test.ts > allocation-cholesky-factor — Cholesky factor of a correlation matrix > the factor reconstructs the off-diagonal 0.5 and the unit diagonal
AssertionError: LL^T second diagonal 0.7500000000000001 is not within {"abs":1e-12} of 1: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/allocation/assetClasses.evidence.test.ts:46:9
     44|         withinTolerance(secondDiag, 1, example.tolerance),
     45|         `LL^T second diagonal ${secondDiag} is not within ${JSON.strin…
     46|       ).toBe(true)
       |         ^
     47|     })
     48|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

`git checkout -- packages/engine/src/allocation/assetClasses.ts`, then `git diff --quiet -- packages/engine/src/allocation/assetClasses.ts` exited 0, confirming no change to production code after the run.
