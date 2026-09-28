# Mutation receipt: survivor-convert-early-lever

Executed 2026-09-28 against RetireGolden base `34544677` (branch `claude/b2p1-slice5-sweeps`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `edf7cdb1` (branch `claude/b2p1-slice5-sweeps`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualAggregateRothConversionTargetPlan.ts`

```diff
diff --git a/packages/engine/src/projection/internal/annualAggregateRothConversionTargetPlan.ts b/packages/engine/src/projection/internal/annualAggregateRothConversionTargetPlan.ts
index b181f266..f9956da1 100644
--- a/packages/engine/src/projection/internal/annualAggregateRothConversionTargetPlan.ts
+++ b/packages/engine/src/projection/internal/annualAggregateRothConversionTargetPlan.ts
@@ -273,7 +273,7 @@ export function annualAggregateRothConversionTargetPlan(
     if (source.convertible) convertiblePlanDollars += Math.max(0, source.balancePlanDollars)
   }
   const fillTargetPlanDollars = Math.min(fill.desiredPlanDollars, convertiblePlanDollars)
-  const selected = fillTargetPlanDollars > own.desiredPlanDollars ? 'fill' : 'own'
+  const selected = 'fill'
   const facts: AdditionalBracketFillTarget = {
     year: input.year,
     ownTargetPlanDollars: own.desiredPlanDollars,
```

This replaces the plan's own conversion with the fill in every window year, the retired lever and the worksheet's first wrong reading: case L-A's plan converting 55,000 converts 40,800 with the lever, 14,200 less than the plan, and its covered year is read as raised.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/survivorTransition.lever.evidence.test.ts
```

## Captured failing output

the slice 5 review fixes moved the production lines and test titles these receipts quote The baseline is green (survivorTransition.lever.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine16/packages/engine

 ❯ src/projection/survivorTransition.lever.evidence.test.ts (4 tests | 2 failed) 49ms
   ❯ survivor-convert-early-lever — Survivor convert-early lever (4)
     × L-A: converts the larger of the plan's own conversion and the 12% fill, never less than the plan 37ms
     × L-B: gives each window year its own reason from executed dollars, with the ledger's words 3ms

 Test Files  1 failed (1)
      Tests  2 failed | 2 passed (4)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/survivorTransition.lever.evidence.test.ts > survivor-convert-early-lever — Survivor convert-early lever > L-A: converts the larger of the plan's own conversion and the 12% fill, never less than the plan
AssertionError: L-A manual 55,000 conversion: 40800 against the worksheet's 55000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ close src/projection/survivorTransition.lever.evidence.test.ts:119:127
    117|   ({ example }) => {
    118|     const close = (actual: number, expected: number, label: string) =>
    119|       expect(withinTolerance(actual, expected, example.tolerance), `${…
       |                                                                                                                               ^
    120|
    121|     it('L-A: converts the larger of the plan\'s own conversion and the…
 ❯ src/projection/survivorTransition.lever.evidence.test.ts:124:9

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/projection/survivorTransition.lever.evidence.test.ts > survivor-convert-early-lever — Survivor convert-early lever > L-B: gives each window year its own reason from executed dollars, with the ledger's words
AssertionError: L-B manual 55,000 conversion: 40800 against the worksheet's 55000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ close src/projection/survivorTransition.lever.evidence.test.ts:119:127
    117|   ({ example }) => {
    118|     const close = (actual: number, expected: number, label: string) =>
    119|       expect(withinTolerance(actual, expected, example.tolerance), `${…
       |                                                                                                                               ^
    120|
    121|     it('L-A: converts the larger of the plan\'s own conversion and the…
 ❯ src/projection/survivorTransition.lever.evidence.test.ts:153:9

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/annualAggregateRothConversionTargetPlan.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/annualAggregateRothConversionTargetPlan.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
