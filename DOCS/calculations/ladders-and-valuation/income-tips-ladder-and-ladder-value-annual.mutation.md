# Mutation receipt: income-tips-ladder-and-ladder-value-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-thirteen` at base `1452ae11`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730), and re-executed 2026-09-27 against RetireGolden base `fe28be3c` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `b2897dfe` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `aea4dac1` (branch `claude/2027-rollover`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/ladder/ladderMath.ts`

```diff
diff --git a/packages/engine/src/ladder/ladderMath.ts b/packages/engine/src/ladder/ladderMath.ts
index 19c7a7c0..f3fcbf97 100644
--- a/packages/engine/src/ladder/ladderMath.ts
+++ b/packages/engine/src/ladder/ladderMath.ts
@@ -183,7 +183,7 @@ export function ladderRealFlowsAtOffset(rungs: readonly Readonly<LadderRung>[],
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

Decision D-2027-ROLLOVER moved the lines these receipts quote (the per-publisher parameter split and the pre-start warnings in projection/simulate.ts and its annual phases, imports added to evidence files) and restated six of the records; the mutations are unchanged. The baseline is green (tipsLadderAnnualCashFlow.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/projection/internal/tipsLadderAnnualCashFlow.evidence.test.ts (6 tests | 2 failed) 42ms
   ❯ income-tips-ladder-and-ladder-value-annual — TIPS ladder annual cash and remaining ladder value (4)
     × pays 8820 at offset 1 and leaves 16800 of unmatured face 4ms
     × publishes the same purchase-year branch on a real projection 29ms

 Test Files  1 failed (1)
      Tests  2 failed | 4 passed (6)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/tipsLadderAnnualCashFlow.evidence.test.ts > income-tips-ladder-and-ladder-value-annual — TIPS ladder annual cash and remaining ladder value > pays 8820 at offset 1 and leaves 16800 of unmatured face
AssertionError: offset-1 ladderValue 25200 is not within {"abs":0.005} of 16800: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/tipsLadderAnnualCashFlow.evidence.test.ts:100:9
     98|         withinTolerance(actual, target, example.tolerance),
     99|         `${label} ${actual} is not within ${JSON.stringify(example.tol…
    100|       ).toBe(true)
       |         ^
    101|     }
    102|
 ❯ src/projection/internal/tipsLadderAnnualCashFlow.evidence.test.ts:118:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/projection/internal/tipsLadderAnnualCashFlow.evidence.test.ts > income-tips-ladder-and-ladder-value-annual — TIPS ladder annual cash and remaining ladder value > publishes the same purchase-year branch on a real projection
AssertionError: offset-1 published ladderValue 9810.654370646522 is not within {"abs":0.005} of 0: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/tipsLadderAnnualCashFlow.evidence.test.ts:100:9
     98|         withinTolerance(actual, target, example.tolerance),
     99|         `${label} ${actual} is not within ${JSON.stringify(example.tol…
    100|       ).toBe(true)
       |         ^
    101|     }
    102|
 ❯ src/projection/internal/tipsLadderAnnualCashFlow.evidence.test.ts:167:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/ladder/ladderMath.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/ladder/ladderMath.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
