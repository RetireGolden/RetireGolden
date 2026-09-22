# Mutation receipt: current-spouse-excess-fallback

Executed 2026-09-18 against RetireGolden base `989fc81b` (branch claude/b1-p4-cards-slice-eight) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualSocialSecurity.ts`

```diff
@@ -300,7 +300,7 @@ export function annualSocialSecurity(
         })
         const excessSpousalMonthly =
           guardedComponents?.auxiliaryMonthly ??
-          Math.max(0, rawSpousalMonthly - lowerOwnMonthly)
+          Math.max(0, (0.5 * higher.ss.pia - lower.ss.pia) * spousalFactor)
         const cappedExcessMonthly = capAuxiliaryForFamilyMaximum({
           workerPiaMonthly: higher.ss.pia,
           workerActualMonthly,
```

This puts the POMS order into the fallback arm, subtracting on unreduced PIAs before reducing, so the auxiliary becomes 1,250/3 and the combined benefit 3,850/3 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualSocialSecurity.evidence.test.ts
```

## Captured failing output

```
FAIL  src/projection/internal/annualSocialSecurity.evidence.test.ts > current-spouse-excess-fallback — Current-spouse excess: the annual phase's reduce-then-subtract fallback > reduces the full spousal amount first, publishing a 1,150/3 auxiliary and a 1,250 combined benefit
AssertionError: combinedMonthly 1283.3333333333335 is not within {"abs":1e-9} of the worksheet's 1250: expected false to be true // Object.is equality

FAIL  src/projection/internal/annualSocialSecurity.evidence.test.ts > current-spouse-excess-fallback — Current-spouse excess: the annual phase's reduce-then-subtract fallback > differs from the POMS-order figure the paired worksheet publishes
AssertionError: expected 1283.3333333333335 to be less than 1283.3333333333333
```

## Revert

`git checkout -- packages/engine/src/projection/internal/annualSocialSecurity.ts`, then `git diff --quiet -- packages/engine/src/projection/internal/annualSocialSecurity.ts` exited 0, confirming no change to production code after the run.
