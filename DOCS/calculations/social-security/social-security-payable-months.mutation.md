# Mutation receipt: social-security-payable-months

Executed 2026-09-18 against RetireGolden base `989fc81b` (branch claude/b1-p4-cards-slice-eight) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualSocialSecurity.ts`

```diff
@@ -70,7 +70,7 @@ export function annualSocialSecurityPayableMonths(
 ): number {
   if (ageAttained < claimAge.years) return 0
   if (ageAttained > claimAge.years) return 12
-  return Math.max(0, 12 - claimAge.months)
+  return Math.max(0, 13 - claimAge.months)
 }
 
 export function annualSocialSecurity(
```

This includes the claim month itself, paying 9 months in the claim year — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualSocialSecurity.evidence.test.ts
```

## Captured failing output

```
FAIL  src/projection/internal/annualSocialSecurity.evidence.test.ts > social-security-payable-months — Social Security payable months > pays 0, then 8, then 12 months around a 65y4m claim
AssertionError: claimYear 9 is not within "exact" of the worksheet's 8: expected false to be true // Object.is equality

FAIL  src/projection/internal/annualSocialSecurity.evidence.test.ts > social-security-payable-months — Social Security payable months > excludes the claim month itself, so a whole-year claim pays all twelve
AssertionError: expected 13 to be 12 // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/internal/annualSocialSecurity.ts`, then `git diff --quiet -- packages/engine/src/projection/internal/annualSocialSecurity.ts` exited 0, confirming no change to production code after the run.
