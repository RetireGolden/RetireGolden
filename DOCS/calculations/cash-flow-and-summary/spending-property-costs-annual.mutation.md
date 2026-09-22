# Mutation receipt: spending-property-costs-annual

Executed 2026-09-18 against RetireGolden base `60e47fd8` (branch claude/b1-p4-cards-slice-eleven) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualPropertyCarryingCosts.ts`

```diff
@@ -43,8 +43,8 @@
     if (account.plannedSaleYear !== null && input.year >= account.plannedSaleYear) continue
 
     const amount =
-      ((account.propertyTaxAnnual ?? 0) + (account.insuranceAnnual ?? 0)) *
-      input.inflFactor
+      (account.propertyTaxAnnual ?? 0) * input.inflFactor +
+      (account.insuranceAnnual ?? 0)
     const record: RecordedAccountAmount = {
       accountId: account.id,
       ownerPersonId: account.ownerPersonId ?? null,
```

This inflates the property tax but not the homeowner insurance, publishing $4,500 — the worksheet's second wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualPropertyCarryingCosts.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/projection/internal/annualPropertyCarryingCosts.evidence.test.ts > spending-property-costs-annual — Annual property carrying costs on owned properties > inflates both carrying components on Home A and charges nothing in Home B sale year
AssertionError: Home A carrying cost 4500 is not within {"abs":0.005} of the worksheet's 4620: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/internal/annualPropertyCarryingCosts.ts`, then `git diff --quiet -- packages/engine/src/projection/internal/annualPropertyCarryingCosts.ts` exited 0, confirming no change to production code after the run.
