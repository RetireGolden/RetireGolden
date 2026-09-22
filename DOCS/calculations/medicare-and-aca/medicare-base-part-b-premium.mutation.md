# Mutation receipt: medicare-base-part-b-premium

Executed 2026-09-18 against RetireGolden base `989fc81b` (branch claude/b1-p4-cards-slice-eight) in `packages/engine`.

## Mutation applied to `packages/engine/src/tax/medicare.ts`

```diff
@@ -58,7 +58,7 @@ export function medicareAnnualPremiumPerPerson(
   const partBMonthly = base * (applicablePct / 25) * premiumScale
 
   return {
-    partBAnnual: partBMonthly * 12,
+    partBAnnual: partBMonthly,
     partDSurchargeAnnual: partDSurchargeMonthly * 12 * premiumScale,
     irmaaSurchargeAnnual:
       Math.max(0, partBMonthly - base * premiumScale) * 12 +
```

This treats the $202.90 monthly premium as the annual figure — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/tax/medicare.evidence.test.ts
```

## Captured failing output

```
FAIL  src/tax/medicare.evidence.test.ts > medicare-base-part-b-premium — Medicare base Part B premium > annualizes the 202.90 standard monthly premium into 2,434.80 at tier 0
AssertionError: partBAnnual 202.9 is not within {"abs":0.005} of the worksheet's 2434.8: expected false to be true // Object.is equality

FAIL  src/tax/medicare.evidence.test.ts > medicare-base-part-b-premium — Medicare base Part B premium > charges twelve months, not one
AssertionError: partBAnnual 202.9 is not within {"abs":0.005} of the worksheet's 2434.8: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/tax/medicare.ts`, then `git diff --quiet -- packages/engine/src/tax/medicare.ts` exited 0, confirming no change to production code after the run.
