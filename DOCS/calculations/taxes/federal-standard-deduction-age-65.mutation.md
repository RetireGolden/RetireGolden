# Mutation receipt: federal-standard-deduction-age-65

Executed 2026-09-18 against RetireGolden base `989fc81b` (branch claude/b1-p4-cards-slice-eight) in `packages/engine`.

## Mutation applied to `packages/engine/src/params/index.ts`

```diff
@@ -395,5 +395,5 @@ export function standardDeduction(
 ): number {
   const base = pack.federalTax.standardDeduction[filingStatus]
   const addition = age65StandardDeductionAddition(pack.federalTax.age65Addition, filingStatus, peopleAged65Plus)
-  return base + addition
+  return base + addition * 0
 }
```

This drops the per-person age-65 addition from the composed deduction, publishing $16,100 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/tax/federalTax.evidence.test.ts
```

## Captured failing output

```
FAIL  src/tax/federalTax.evidence.test.ts > federal-standard-deduction-age-65 — Federal standard deduction with the age-65 addition > composes 16,100 + 1 x 2,050 into an 18,150 standard deduction
AssertionError: standardDeduction 16100 is not within "exact" of the worksheet's 18150: expected false to be true // Object.is equality

FAIL  src/tax/federalTax.evidence.test.ts > federal-standard-deduction-age-65 — Federal standard deduction with the age-65 addition > is the deduction computeFederalTax elects once the separate senior deduction has phased out
AssertionError: deduction 16100 is not within "exact" of the worksheet's 18150: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/params/index.ts`, then `git diff --quiet -- packages/engine/src/params/index.ts` exited 0, confirming no change to production code after the run.
