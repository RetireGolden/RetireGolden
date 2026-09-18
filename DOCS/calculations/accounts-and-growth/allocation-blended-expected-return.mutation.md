# Mutation receipt: allocation-blended-expected-return

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch claude/b1-p4-cards-accounts-spending) in `packages/engine`.

## Mutation applied to `packages/engine/src/allocation/assetClasses.ts`

```diff
@@ -159,7 +159,7 @@ export function targetWeightsAt(policy: AssetAllocationPolicy, year: number): nu
 
 /** Blended expected nominal return for a weight vector, percent. */
 export function blendedReturnPct(weights: number[], params: Record<AssetClassId, AssetClassParams>): number {
-  return ASSET_CLASS_IDS.reduce((sum, id, i) => sum + (weights[i] ?? 0) * params[id].returnPct, 0)
+  return ASSET_CLASS_IDS.reduce((sum, id, i) => sum + (weights[i] ?? 0) * params[id].returnPct / 100, 0)
 }
 
 export interface BlendedTaxableYield {
```

This divides the class returns by 100 a second time, the worksheet's first wrong reading: the blend returns 0.058 instead of 5.8, a 5.742 percentage-point miss against the 1e-12 tolerance. The ledger-parity assertion in the same block fails in the opposite direction (the ledger's inline copy still grows the account by 5.8% and now disagrees with the mutated function), and `allocation-account-expected-return` fails because its allocated branch reads the mutated blend.

## Command

```
npx vitest run src/allocation/assetClasses.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1`, stdout and stderr together; stdout precedes stderr, so the run summary appears before the failed-test detail. Blank lines, the `Start at` and `Duration` lines, and Vitest's transform-cache performance hint (when printed) are the only lines removed. The run exited 1.

```
 RUN  v5.0.0 C:/TEMP/rg-s5/packages/engine
 ❯ src/allocation/assetClasses.evidence.test.ts (32 tests | 3 failed) 9ms
   ❯ allocation-blended-expected-return — Blended expected nominal return of a weight vector (3)
     × blends 0.6 x 7% + 0.4 x 4% to 5.8% 3ms
     × the ledger's inline copy grows an allocated account by the same 5.8% at zero shock 1ms
   ❯ allocation-account-expected-return — Expected return for an account: allocation blend, else account rate, else plan default (4)
     × uses the 5.8% blend and ignores the 9% account scalar when the account carries an allocation 0ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/allocation/assetClasses.evidence.test.ts > allocation-blended-expected-return — Blended expected nominal return of a weight vector > blends 0.6 x 7% + 0.4 x 4% to 5.8%
AssertionError: blendedReturnPct 0.058 is not within {"abs":1e-12} of the worksheet's 5.8: expected false to be true // Object.is equality
- Expected
+ Received
- true
+ false
 ❯ src/allocation/assetClasses.evidence.test.ts:290:9
    288|         withinTolerance(blended, expected, example.tolerance),
    289|         `blendedReturnPct ${blended} is not within ${JSON.stringify(ex…
    290|       ).toBe(true)
       |         ^
    291|     })
    292|
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯
 FAIL  src/allocation/assetClasses.evidence.test.ts > allocation-blended-expected-return — Blended expected nominal return of a weight vector > the ledger's inline copy grows an allocated account by the same 5.8% at zero shock
AssertionError: ledger growth 5.800000000000005 is not within {"abs":1e-12} of blendedReturnPct 0.058: expected false to be true // Object.is equality
- Expected
+ Received
- true
+ false
 ❯ src/allocation/assetClasses.evidence.test.ts:299:9
    297|         withinTolerance(ledger, pinned, example.tolerance),
    298|         `ledger growth ${ledger} is not within ${JSON.stringify(exampl…
    299|       ).toBe(true)
       |         ^
    300|     })
    301|   },
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯
 FAIL  src/allocation/assetClasses.evidence.test.ts > allocation-account-expected-return — Expected return for an account: allocation blend, else account rate, else plan default > uses the 5.8% blend and ignores the 9% account scalar when the account carries an allocation
AssertionError: withAllocationPct 0.058 is not within {"abs":1e-12} of the worksheet's 5.8: expected false to be true // Object.is equality
- Expected
+ Received
- true
+ false
 ❯ src/allocation/assetClasses.evidence.test.ts:344:9
    342|         withinTolerance(rate, expected, example.tolerance),
    343|         `withAllocationPct ${rate} is not within ${JSON.stringify(exam…
    344|       ).toBe(true)
       |         ^
    345|     })
    346|
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
 Test Files  1 failed (1)
      Tests  3 failed | 29 passed (32)
```

## Revert

`git checkout -- packages/engine/src/allocation/assetClasses.ts`, then `git diff --quiet -- packages/engine/src/allocation/assetClasses.ts` exited 0, confirming no change to production code after the run.
