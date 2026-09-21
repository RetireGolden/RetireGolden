# Mutation receipt: allocation-rebalance-turnover

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch claude/b1-p4-cards-accounts-spending) in `packages/engine`.

## Mutation applied to `packages/engine/src/allocation/assetClasses.ts`

```diff
@@ -208,7 +208,7 @@ export function driftWeights(weights: number[], ratesPct: number[]): number[] {
 export function rebalanceTurnoverFraction(current: readonly number[], target: readonly number[]): number {
   let turnover = 0
   for (let i = 0; i < current.length; i++) {
-    turnover += Math.max(0, (current[i] ?? 0) - (target[i] ?? 0))
+    turnover += Math.abs((current[i] ?? 0) - (target[i] ?? 0))
   }
   return turnover
 }
```

This sums absolute differences instead of the positive ones, the worksheet's first wrong reading: 0.2 instead of 0.1, double-counting buys and sells, a 0.1 miss against the 1e-12 tolerance. The reverse-move assertion fails the same way; the zero-turnover assertion still passes because equal vectors differ by nothing.

## Command

```
npx vitest run src/allocation/assetClasses.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1`, stdout and stderr together; stdout precedes stderr, so the run summary appears before the failed-test detail. Blank lines, the `Start at` and `Duration` lines, and Vitest's transform-cache performance hint (when printed) are the only lines removed. The run exited 1.

```
 RUN  v5.0.0 C:/TEMP/rg-s5/packages/engine
 ❯ src/allocation/assetClasses.evidence.test.ts (32 tests | 2 failed) 10ms
   ❯ allocation-rebalance-turnover — Rebalance turnover: the fraction sold to reach the target weights (3)
     × sells 0.1 of the account to move 70/30 to 60/40 3ms
     × counts each dollar moved once: the reverse move also sells 0.1, not 0.2 0ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/allocation/assetClasses.evidence.test.ts > allocation-rebalance-turnover — Rebalance turnover: the fraction sold to reach the target weights > sells 0.1 of the account to move 70/30 to 60/40
AssertionError: turnoverFraction 0.2 is not within {"abs":1e-12} of the worksheet's 0.1: expected false to be true // Object.is equality
- Expected
+ Received
- true
+ false
 ❯ src/allocation/assetClasses.evidence.test.ts:480:9
    478|         withinTolerance(turnover, expected, example.tolerance),
    479|         `turnoverFraction ${turnover} is not within ${JSON.stringify(e…
    480|       ).toBe(true)
       |         ^
    481|     })
    482|
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯
 FAIL  src/allocation/assetClasses.evidence.test.ts > allocation-rebalance-turnover — Rebalance turnover: the fraction sold to reach the target weights > counts each dollar moved once: the reverse move also sells 0.1, not 0.2
AssertionError: reverse turnover 0.2 is not within {"abs":1e-12} of the worksheet's 0.1: expected false to be true // Object.is equality
- Expected
+ Received
- true
+ false
 ❯ src/allocation/assetClasses.evidence.test.ts:494:9
    492|         withinTolerance(reverse, expected, example.tolerance),
    493|         `reverse turnover ${reverse} is not within ${JSON.stringify(ex…
    494|       ).toBe(true)
       |         ^
    495|     })
    496|   },
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
 Test Files  1 failed (1)
      Tests  2 failed | 30 passed (32)
```

## Revert

`git checkout -- packages/engine/src/allocation/assetClasses.ts`, then `git diff --quiet -- packages/engine/src/allocation/assetClasses.ts` exited 0, confirming no change to production code after the run.
