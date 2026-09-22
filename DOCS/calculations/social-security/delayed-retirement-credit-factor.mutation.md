# Mutation receipt: delayed-retirement-credit-factor

Executed 2026-09-18 against RetireGolden base `989fc81b` (branch claude/b1-p4-cards-slice-eight) in `packages/engine`.

## Mutation applied to `packages/engine/src/socialSecurity/benefitFactor.ts`

```diff
@@ -26,7 +26,7 @@ export function delayedRetirementFactor(
 ): number {
   if (monthsAfterFra <= 0) return 1
   const d = Math.min(monthsAfterFra, Math.max(0, maxMonthsAfterFraToAge70))
-  return 1 + (d * (2 / 3)) / 100
+  return 1 + (d * (5 / 9)) / 100
 }
 
 export function retirementBenefitPiaFactor(
```

This credits delayed months at the early-claim 5/9-of-1% rate, publishing a factor of 1.1333... — the worksheet's second wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/socialSecurity/benefitFactor.evidence.test.ts
```

## Captured failing output

```
FAIL  src/socialSecurity/benefitFactor.evidence.test.ts > delayed-retirement-credit-factor — Delayed retirement credit factor > credits 24 months at 2/3 of 1% for a factor of 1.16
AssertionError: factor 1.1333333333333333 is not within {"abs":1e-12} of the worksheet's 1.16: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/socialSecurity/benefitFactor.ts`, then `git diff --quiet -- packages/engine/src/socialSecurity/benefitFactor.ts` exited 0, confirming no change to production code after the run.
