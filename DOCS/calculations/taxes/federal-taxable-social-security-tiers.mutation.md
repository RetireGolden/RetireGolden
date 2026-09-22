# Mutation receipt: federal-taxable-social-security-tiers

Executed 2026-09-18 against RetireGolden base `989fc81b` (branch claude/b1-p4-cards-slice-eight) in `packages/engine`.

## Mutation applied to `packages/engine/src/tax/federalTax.ts`

```diff
@@ -351,7 +351,7 @@ export function taxableSocialSecurity(
     agiExcludingSs +
     Math.max(0, taxExemptInterest) +
     Math.max(0, foreignExclusionAddback) +
-    0.5 * ssBenefits
+    0 * ssBenefits
 
   if (provisional <= t50) return 0
   if (provisional <= t85) return Math.min(0.5 * ssBenefits, 0.5 * (provisional - t50))
```

This omits half the gross benefit from provisional income, so the 50% tier case falls to $0 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/tax/federalTax.evidence.test.ts
```

## Captured failing output

```
FAIL  src/tax/federalTax.evidence.test.ts > federal-taxable-social-security-tiers — Federal taxable Social Security tiers > publishes 0, 2,500 and 9,600 across the three 2026 single-filer tiers
AssertionError: tier50 0 is not within "exact" of the worksheet's 2500: expected false to be true // Object.is equality

FAIL  src/tax/federalTax.evidence.test.ts > federal-taxable-social-security-tiers — Federal taxable Social Security tiers > counts half the benefit in provisional income, so the below-base case sits exactly at 20,000
AssertionError: expected 0 to be greater than 0
```

## Revert

`git checkout -- packages/engine/src/tax/federalTax.ts`, then `git diff --quiet -- packages/engine/src/tax/federalTax.ts` exited 0, confirming no change to production code after the run.
