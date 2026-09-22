# Mutation receipt: income-annuity-annual

Executed 2026-09-18 against RetireGolden base `39f8f460` (branch claude/b1-p4-cards-slice-nine) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualPensionAndAnnuityIncome.ts`

```diff
@@ -315,7 +315,7 @@ export function annualPensionAndAnnuityIncome(
     })
     if (paidFraction <= 0) continue
 
-    const paid = grown * paidFraction
+    const paid = grown
     annuityIncome += paid
     let annuityTaxable: number
     let nonqualifiedExcludable = 0
```

This ignores the payout form's fraction, paying the joint annuitant the full post-COLA amount of $18,360 — the worksheet's second wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualPensionAndAnnuityIncome.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/projection/internal/annualPensionAndAnnuityIncome.evidence.test.ts > income-annuity-annual — Annual annuity income under the joint-survivor payout form > continues 60 percent of a once-COLAd annuity to the joint annuitant: 11016.00
AssertionError: annuity: actual 18360, worksheet 11016: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/internal/annualPensionAndAnnuityIncome.ts`, then `git diff --quiet -- packages/engine/src/projection/internal/annualPensionAndAnnuityIncome.ts` exited 0, confirming no change to production code after the run.
