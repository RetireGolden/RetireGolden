# Mutation receipt: federal-taxable-social-security-tiers

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eight` at base `989fc81b`, and re-executed 2026-09-22 against RetireGolden base `a046c8f0` (branch `claude/b1-p4-cards-eight`, pull request #728) in `packages/engine`.

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

Re-executed 2026-09-22 on the pull-request branch after the review of #728: the branch was renamed for the pull request and two fixtures and one mutation changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (federalTax.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/tax/federalTax.evidence.test.ts (13 tests | 2 failed) 8ms
   ❯ federal-taxable-social-security-tiers — Federal taxable Social Security tiers (3)
     × publishes 0, 2,500 and 9,600 across the three 2026 single-filer tiers 3ms
     × counts half the benefit in provisional income, so the below-base case sits exactly at 20,000 0ms

 Test Files  1 failed (1)
      Tests  2 failed | 11 passed (13)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/tax/federalTax.evidence.test.ts > federal-taxable-social-security-tiers — Federal taxable Social Security tiers > publishes 0, 2,500 and 9,600 across the three 2026 single-filer tiers
AssertionError: tier50 0 is not within "exact" of the worksheet's 2500: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/tax/federalTax.evidence.test.ts:32:5
     30|     withinTolerance(actual, expected, tolerance),
     31|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     32|   ).toBe(true)
       |     ^
     33| }
     34|
 ❯ src/tax/federalTax.evidence.test.ts:333:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/tax/federalTax.evidence.test.ts > federal-taxable-social-security-tiers — Federal taxable Social Security tiers > counts half the benefit in provisional income, so the below-base case sits exactly at 20,000
AssertionError: expected 0 to be greater than 0
 ❯ src/tax/federalTax.evidence.test.ts:341:67
    339|       // against the 25,000 floor and every case would tier lower.
    340|       expect(taxableFor(inputs.agiExcludingSsBelowBase!)).toBe(0)
    341|       expect(taxableFor(inputs.agiExcludingSsBelowBase! + 5_001)).toBe…
       |                                                                   ^
    342|     })
    343|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/tax/federalTax.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/tax/federalTax.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
