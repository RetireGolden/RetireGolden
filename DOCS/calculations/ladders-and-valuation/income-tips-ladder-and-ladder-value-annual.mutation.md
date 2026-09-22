# Mutation receipt: income-tips-ladder-and-ladder-value-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-thirteen` at base `1452ae11`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730) in `packages/engine`.

## Mutation applied to `packages/engine/src/ladder/ladderMath.ts`

```diff
diff --git a/packages/engine/src/ladder/ladderMath.ts b/packages/engine/src/ladder/ladderMath.ts
index 366b8459..9e84149e 100644
--- a/packages/engine/src/ladder/ladderMath.ts
+++ b/packages/engine/src/ladder/ladderMath.ts
@@ -181,7 +181,7 @@ export function ladderRealFlowsAtOffset(rungs: readonly Readonly<LadderRung>[],
  */
 export function ladderRemainingFace(rungs: readonly Readonly<LadderRung>[], offset: number): number {
   let face = 0
-  for (const rung of rungs) if (rung.maturityOffset > offset) face += rung.face
+  for (const rung of rungs) if (rung.maturityOffset >= offset) face += rung.face
   return face
 }
 
```

Keep the rung that matured THIS year in the remaining face — the worksheet's second wrong reading. Offset-1 year-end value becomes $30,000 x 0.8 x 1.05 = $25,200 instead of $16,800, and the real projection beside it stops emptying: the ladder still shows $9,818.36 of face in the year its only rung paid out.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/tipsLadderAnnualCashFlow.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #730: the branch was renamed for the pull request, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (tipsLadderAnnualCashFlow.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/internal/tipsLadderAnnualCashFlow.evidence.test.ts (4 tests | 2 failed) 31ms
   ❯ income-tips-ladder-and-ladder-value-annual — TIPS ladder annual cash and remaining ladder value (4)
     × pays 8820 at offset 1 and leaves 16800 of unmatured face 3ms
     × publishes the same purchase-year branch on a real projection 26ms

 Test Files  1 failed (1)
      Tests  2 failed | 2 passed (4)

  Transform  transforming modules took 2.38s · 45% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/tipsLadderAnnualCashFlow.evidence.test.ts > income-tips-ladder-and-ladder-value-annual — TIPS ladder annual cash and remaining ladder value > pays 8820 at offset 1 and leaves 16800 of unmatured face
AssertionError: offset-1 ladderValue 25200 is not within {"abs":0.005} of 16800: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/tipsLadderAnnualCashFlow.evidence.test.ts:98:9
     96|         withinTolerance(actual, target, example.tolerance),
     97|         `${label} ${actual} is not within ${JSON.stringify(example.tol…
     98|       ).toBe(true)
       |         ^
     99|     }
    100|
 ❯ src/projection/internal/tipsLadderAnnualCashFlow.evidence.test.ts:116:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/projection/internal/tipsLadderAnnualCashFlow.evidence.test.ts > income-tips-ladder-and-ladder-value-annual — TIPS ladder annual cash and remaining ladder value > publishes the same purchase-year branch on a real projection
AssertionError: offset-1 published ladderValue 9818.360333824252 is not within {"abs":0.005} of 0: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/tipsLadderAnnualCashFlow.evidence.test.ts:98:9
     96|         withinTolerance(actual, target, example.tolerance),
     97|         `${label} ${actual} is not within ${JSON.stringify(example.tol…
     98|       ).toBe(true)
       |         ^
     99|     }
    100|
 ❯ src/projection/internal/tipsLadderAnnualCashFlow.evidence.test.ts:165:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/ladder/ladderMath.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/ladder/ladderMath.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
