# Mutation receipt: aca-household-magi-composition

Executed 2026-09-18 against RetireGolden base `989fc81b` (branch claude/b1-p4-cards-slice-eight) in `packages/engine`.

## Mutation applied to `packages/engine/src/tax/aca.ts`

```diff
@@ -89,7 +89,7 @@ export function buildAcaHouseholdMagi(input: AcaHouseholdMagiInput): AcaHousehol
     // A capital-loss deduction can make AGI negative and must offset positive
     // ACA addbacks before the final household-income floor is applied.
     federalAgi: input.federalAgi,
-    nontaxableSocialSecurity: Math.max(0, input.grossSocialSecurity - input.taxableSocialSecurity),
+    nontaxableSocialSecurity: Math.max(0, input.grossSocialSecurity),
     taxExemptInterest:
       input.taxExemptInterest.state === 'known' ? Math.max(0, input.taxExemptInterest.amount ?? 0) : 0,
     foreignExclusionAddback:
```

This adds gross Social Security without subtracting its taxable share, double-counting $5,000 and publishing $76,000 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/tax/aca.evidence.test.ts
```

## Captured failing output

```
FAIL  src/tax/aca.evidence.test.ts > aca-household-magi-composition — ACA household MAGI composition > sums 50,000 + 15,000 + 1,000 + 2,000 + 3,000 into a 71,000 actionable household MAGI
AssertionError: magi 76000 is not within "exact" of the worksheet's 71000: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/tax/aca.ts`, then `git diff --quiet -- packages/engine/src/tax/aca.ts` exited 0, confirming no change to production code after the run.
