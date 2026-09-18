# Mutation receipt: allocation-account-expected-return

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch claude/b1-p4-cards-accounts-spending) in `packages/engine`.

## Mutation applied to `packages/engine/src/allocation/assetClasses.ts`

```diff
@@ -246,7 +246,7 @@ export function planUsesAssetAllocation(plan: Plan): boolean {
  */
 export function expectedAccountReturnPct(account: Account, assumptions: Assumptions, year: number): number {
   const policy = accountAllocation(account)
-  if (policy) {
+  if (policy && !('annualReturnPct' in account && account.annualReturnPct !== null)) {
     return blendedReturnPct(targetWeightsAt(policy, year), resolveAssetClassParams(assumptions.assetClassParams))
   }
   const own = 'annualReturnPct' in account ? account.annualReturnPct : null
```

This lets a non-null account scalar override the allocation, the worksheet's first wrong reading: the allocated account returns its 9% `annualReturnPct` instead of the 5.8% blend, a 3.2 percentage-point miss against the 1e-12 tolerance. The two fallback assertions and the ledger-parity assertion still pass, because the scalar precedence and the ledger's inline copy are untouched.

## Command

```
npx vitest run src/allocation/assetClasses.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1`, stdout and stderr together; stdout precedes stderr, so the run summary appears before the failed-test detail. Blank lines, the `Start at` and `Duration` lines, and Vitest's transform-cache performance hint (when printed) are the only lines removed. The run exited 1.

```
 RUN  v5.0.0 C:/TEMP/rg-s5/packages/engine
 ❯ src/allocation/assetClasses.evidence.test.ts (32 tests | 1 failed) 10ms
   ❯ allocation-account-expected-return — Expected return for an account: allocation blend, else account rate, else plan default (4)
     × uses the 5.8% blend and ignores the 9% account scalar when the account carries an allocation 4ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/allocation/assetClasses.evidence.test.ts > allocation-account-expected-return — Expected return for an account: allocation blend, else account rate, else plan default > uses the 5.8% blend and ignores the 9% account scalar when the account carries an allocation
AssertionError: withAllocationPct 9 is not within {"abs":1e-12} of the worksheet's 5.8: expected false to be true // Object.is equality
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
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
 Test Files  1 failed (1)
      Tests  1 failed | 31 passed (32)
```

## Revert

`git checkout -- packages/engine/src/allocation/assetClasses.ts`, then `git diff --quiet -- packages/engine/src/allocation/assetClasses.ts` exited 0, confirming no change to production code after the run.
