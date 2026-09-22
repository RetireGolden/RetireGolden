# Mutation receipt: spending-total-annual

Executed 2026-09-18 against RetireGolden base `39f8f460` (branch claude/b1-p4-cards-slice-nine) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualExpenseSummary.ts`

```diff
@@ -107,7 +107,7 @@ export function annualExpenseSummary(
       input.propertyCosts +
       input.healthcare +
       input.insurancePremiums +
-      input.careCost -
+      input.careCost +
       input.ltcBenefit,
   }
 
```

This adds the LTC benefit instead of subtracting it, publishing $122,000 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualExpenseSummary.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/projection/internal/annualExpenseSummary.evidence.test.ts > spending-total-annual — Annual net expense total > nets the eight members to 94000 and ignores the factor and the request
AssertionError: expenses.total 122000 is not within {"abs":0.005} of the worksheet's 94000: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/internal/annualExpenseSummary.ts`, then `git diff --quiet -- packages/engine/src/projection/internal/annualExpenseSummary.ts` exited 0, confirming no change to production code after the run.
