# Mutation receipt: allocation-non-cash-share

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch claude/b1-p4-cards-accounts-spending) in `packages/engine`.

## Mutation applied to `packages/engine/src/allocation/assetClasses.ts`

```diff
@@ -216,7 +216,7 @@ export function rebalanceTurnoverFraction(current: readonly number[], target: re
 /** Non-cash share of a weight vector (the market-shocked portion under the single-factor model). */
 export function nonCashWeight(weights: number[]): number {
   const cashIndex = ASSET_CLASS_IDS.indexOf('cash')
-  return Math.max(0, 1 - (weights[cashIndex] ?? 0))
+  return Math.max(0, weights[cashIndex] ?? 0)
 }
 
 type AllocatableAccount = Extract<Account, { type: 'taxable' | 'traditional' | 'roth' | 'hsa' }>
```

This returns the cash share instead of its complement, the worksheet's second wrong reading: 0.1 instead of 0.9, a 0.8 miss against the 1e-12 tolerance. The all-cash endpoint fails with it, returning 1 instead of 0.

## Command

```
npx vitest run src/allocation/assetClasses.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1`, stdout and stderr together; stdout precedes stderr, so the run summary appears before the failed-test detail. Blank lines, the `Start at` and `Duration` lines, and Vitest's transform-cache performance hint (when printed) are the only lines removed. The run exited 1.

```
 RUN  v5.0.0 C:/TEMP/rg-s5/packages/engine
 ❯ src/allocation/assetClasses.evidence.test.ts (32 tests | 2 failed) 10ms
   ❯ allocation-non-cash-share — Non-cash share of a weight vector (3)
     × reads 0.9 for 50/10/30/10, the complement of the 10% cash weight 3ms
     × an all-cash vector has no market-shocked share 0ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/allocation/assetClasses.evidence.test.ts > allocation-non-cash-share — Non-cash share of a weight vector > reads 0.9 for 50/10/30/10, the complement of the 10% cash weight
AssertionError: nonCashShare 0.1 is not within {"abs":1e-12} of the worksheet's 0.9: expected false to be true // Object.is equality
- Expected
+ Received
- true
+ false
 ❯ src/allocation/assetClasses.evidence.test.ts:519:9
    517|         withinTolerance(share, expected, example.tolerance),
    518|         `nonCashShare ${share} is not within ${JSON.stringify(example.…
    519|       ).toBe(true)
       |         ^
    520|     })
    521|
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯
 FAIL  src/allocation/assetClasses.evidence.test.ts > allocation-non-cash-share — Non-cash share of a weight vector > an all-cash vector has no market-shocked share
AssertionError: expected 1 to be +0 // Object.is equality
- Expected
+ Received
- 0
+ 1
 ❯ src/allocation/assetClasses.evidence.test.ts:527:43
    525|
    526|     it('an all-cash vector has no market-shocked share', () => {
    527|       expect(nonCashWeight([0, 0, 0, 1])).toBe(0)
       |                                           ^
    528|     })
    529|   },
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
 Test Files  1 failed (1)
      Tests  2 failed | 30 passed (32)
```

## Revert

`git checkout -- packages/engine/src/allocation/assetClasses.ts`, then `git diff --quiet -- packages/engine/src/allocation/assetClasses.ts` exited 0, confirming no change to production code after the run.
