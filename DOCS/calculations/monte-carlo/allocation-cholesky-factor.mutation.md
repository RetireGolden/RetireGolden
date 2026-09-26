# Mutation receipt: allocation-cholesky-factor

Executed 2026-09-26 against RetireGolden base `8ff951e4` (branch claude/monte-carlo-models), and re-executed 2026-09-26 against RetireGolden base `a78a1c30` (branch `claude/monte-carlo-models`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/allocation/assetClasses.ts`

```diff
--- a/packages/engine/src/allocation/assetClasses.ts
+++ b/packages/engine/src/allocation/assetClasses.ts
@@ mutation @@
-        const pivot = matrix[i]![i]! - sum
+        const pivot = matrix[i]![i]! - 2 * sum
```

Doubles the subtracted inner product in the diagonal pivot, so L22 is sqrt(1 - 0.5) = 0.707 rather than sqrt(3)/2 (the worksheet's first wrong reading, 1 - r under the square root), and a matrix that is not positive definite is no longer caught at the pivot the test names.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/allocation/assetClasses.evidence.test.ts
```

## Captured failing output

Re-executed against the current head so every receipt on the branch records the same commit; the quoted test lines had not moved, and only the timings differ from the earlier run. The baseline is green (assetClasses.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine3/packages/engine

 ❯ src/allocation/assetClasses.evidence.test.ts (32 tests | 3 failed) 11ms
   ❯ allocation-cholesky-factor — Cholesky factor of a correlation matrix (3)
     × factors [[1, 0.5], [0.5, 1]] as [[1, 0], [0.5, sqrt(3)/2]] 4ms
     × the factor reconstructs the off-diagonal 0.5 and the unit diagonal 0ms
     × refuses a matrix that is not positive definite: r = 1 leaves pivot 0 and r = 2 leaves pivot −3 1ms

 Test Files  1 failed (1)
      Tests  3 failed | 29 passed (32)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/allocation/assetClasses.evidence.test.ts > allocation-cholesky-factor — Cholesky factor of a correlation matrix > factors [[1, 0.5], [0.5, 1]] as [[1, 0], [0.5, sqrt(3)/2]]
AssertionError: L[1][1] 0.7071067811865476 is not within {"abs":1e-12} of the worksheet's 0.866025403784439: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/allocation/assetClasses.evidence.test.ts:523:13
    521|             withinTolerance(L[i]![j]!, value, example.tolerance),
    522|             `L[${i}][${j}] ${L[i]![j]} is not within ${JSON.stringify(…
    523|           ).toBe(true)
       |             ^
    524|         })
    525|       })
 ❯ src/allocation/assetClasses.evidence.test.ts:519:13
 ❯ src/allocation/assetClasses.evidence.test.ts:517:16

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  src/allocation/assetClasses.evidence.test.ts > allocation-cholesky-factor — Cholesky factor of a correlation matrix > the factor reconstructs the off-diagonal 0.5 and the unit diagonal
AssertionError: LL^T second diagonal 0.7500000000000001 is not within {"abs":1e-12} of 1: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/allocation/assetClasses.evidence.test.ts:540:9
    538|         withinTolerance(secondDiag, 1, example.tolerance),
    539|         `LL^T second diagonal ${secondDiag} is not within ${JSON.strin…
    540|       ).toBe(true)
       |         ^
    541|     })
    542|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  src/allocation/assetClasses.evidence.test.ts > allocation-cholesky-factor — Cholesky factor of a correlation matrix > refuses a matrix that is not positive definite: r = 1 leaves pivot 0 and r = 2 leaves pivot −3
AssertionError: expected a thrown error to be RangeError: Correlation matrix is not pos…

- Expected
+ Received

  RangeError {
-   "message": "Correlation matrix is not positive definite: the Cholesky pivot at row 1 is 0, not a positive number.",
+   "message": "Correlation matrix is not positive definite: the Cholesky pivot at row 1 is -1, not a positive number.",
  }

 ❯ src/allocation/assetClasses.evidence.test.ts:546:57
    544|       // The second pivot of [[1, r], [r, 1]] is 1 − r^2. The factor u…
    545|       // return the factor of a different matrix; it is now refused.
    546|       expect(() => choleskyDecompose([[1, 1], [1, 1]])).toThrow(
       |                                                         ^
    547|         new RangeError('Correlation matrix is not positive definite: t…
    548|       )

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
```

## Revert

The original bytes of `packages/engine/src/allocation/assetClasses.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/allocation/assetClasses.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
