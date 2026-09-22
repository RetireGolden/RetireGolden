# Mutation receipt: current-spouse-excess-poms-order

Executed 2026-09-18 against RetireGolden base `989fc81b` (branch claude/b1-p4-cards-slice-eight) in `packages/engine`.

## Mutation applied to `packages/engine/src/socialSecurity/currentSpouseBenefit.ts`

```diff
@@ -131,6 +131,6 @@ export function ordinarySimultaneousEarlyCurrentSpouseComponents(
   if (!(unreducedExcess > 0)) return null
   return {
     ownMonthly: input.ownActualMonthly,
-    auxiliaryMonthly: unreducedExcess * input.spousalFactor,
+    auxiliaryMonthly: Math.max(0, 0.5 * input.workerPiaMonthly * input.spousalFactor - input.ownActualMonthly),
   }
 }
```

This reduces the full half-of-worker-PIA spousal amount first and then subtracts the already reduced own benefit, publishing an auxiliary of 1,150/3 — the worksheet's first wrong reading, which is the paired fallback worksheet's figure.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/socialSecurity/currentSpouseBenefit.evidence.test.ts
```

## Captured failing output

```
FAIL  src/socialSecurity/currentSpouseBenefit.evidence.test.ts > current-spouse-excess-poms-order — Current-spouse excess in the POMS order > reduces only the 500 excess, publishing 1,250/3 of auxiliary and 3,850/3 combined
AssertionError: auxiliaryMonthly 383.33333333333326 is not within {"abs":1e-9} of the worksheet's 416.6666666666667: expected false to be true // Object.is equality

FAIL  src/socialSecurity/currentSpouseBenefit.evidence.test.ts > current-spouse-excess-poms-order — Current-spouse excess in the POMS order > does not reduce half the worker PIA before subtracting
AssertionError: expected 383.33333333333326 to be greater than 383.33333333333326
```

## Revert

`git checkout -- packages/engine/src/socialSecurity/currentSpouseBenefit.ts`, then `git diff --quiet -- packages/engine/src/socialSecurity/currentSpouseBenefit.ts` exited 0, confirming no change to production code after the run.
