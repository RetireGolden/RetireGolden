# Mutation receipt: federal-taxable-social-security-tiers

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eight` at base `989fc81b`, and re-executed 2026-09-22 against RetireGolden base `a046c8f0` (branch `claude/b1-p4-cards-eight`, pull request #728), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/tax/federalTax.ts`

```diff
@@ -383,7 +383,7 @@ export function taxableSocialSecurity(
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

Re-executed for D-RECEIPT-DRIFT because its hunk header named a line its production code has since moved from and the test lines and test counts it quoted no longer matched the current test file; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (federalTax.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/tax/federalTax.evidence.test.ts (15 tests | 2 failed) 8ms
   ❯ federal-taxable-social-security-tiers — Federal taxable Social Security tiers (3)
     × publishes 0, 2,500 and 9,600 across the three 2026 single-filer tiers 3ms
     × counts half the benefit in provisional income, so the below-base case sits exactly at 20,000 0ms

 Test Files  1 failed (1)
      Tests  2 failed | 13 passed (15)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/tax/federalTax.evidence.test.ts > federal-taxable-social-security-tiers — Federal taxable Social Security tiers > publishes 0, 2,500 and 9,600 across the three 2026 single-filer tiers
AssertionError: tier50 0 is not within "exact" of the worksheet's 2500: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/tax/federalTax.evidence.test.ts:33:5
     31|     withinTolerance(actual, expected, tolerance),
     32|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     33|   ).toBe(true)
       |     ^
     34| }
     35|
 ❯ src/tax/federalTax.evidence.test.ts:334:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/tax/federalTax.evidence.test.ts > federal-taxable-social-security-tiers — Federal taxable Social Security tiers > counts half the benefit in provisional income, so the below-base case sits exactly at 20,000
AssertionError: expected 0 to be greater than 0
 ❯ src/tax/federalTax.evidence.test.ts:342:67
    340|       // against the 25,000 floor and every case would tier lower.
    341|       expect(taxableFor(inputs.agiExcludingSsBelowBase!)).toBe(0)
    342|       expect(taxableFor(inputs.agiExcludingSsBelowBase! + 5_001)).toBe…
       |                                                                   ^
    343|     })
    344|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/tax/federalTax.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/tax/federalTax.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
