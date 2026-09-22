# Mutation receipt: social-security-payable-months

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eight` at base `989fc81b`, and re-executed 2026-09-22 against RetireGolden base `a046c8f0` (branch `claude/b1-p4-cards-eight`, pull request #728) in `packages/engine`.

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

Re-executed 2026-09-22 on the pull-request branch after the review of #728: the branch was renamed for the pull request and two fixtures and one mutation changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (annualSocialSecurity.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/internal/annualSocialSecurity.evidence.test.ts (6 tests | 2 failed) 33ms
   ❯ social-security-payable-months — Social Security payable months (2)
     × pays 0, then 8, then 12 months around a 65y4m claim 4ms
     × excludes the claim month itself, so a whole-year claim pays all twelve 0ms

 Test Files  1 failed (1)
      Tests  2 failed | 4 passed (6)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/annualSocialSecurity.evidence.test.ts > social-security-payable-months — Social Security payable months > pays 0, then 8, then 12 months around a 65y4m claim
AssertionError: claimYear 9 is not within "exact" of the worksheet's 8: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/annualSocialSecurity.evidence.test.ts:25:5
     23|     withinTolerance(actual, expected, tolerance),
     24|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     25|   ).toBe(true)
       |     ^
     26| }
     27|
 ❯ src/projection/internal/annualSocialSecurity.evidence.test.ts:63:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/projection/internal/annualSocialSecurity.evidence.test.ts > social-security-payable-months — Social Security payable months > excludes the claim month itself, so a whole-year claim pays all twelve
AssertionError: expected 13 to be 12 // Object.is equality

- Expected
+ Received

- 12
+ 13

 ❯ src/projection/internal/annualSocialSecurity.evidence.test.ts:80:99
     78|       // The first wrong reading would pay 9 months here; including th…
     79|       // month would also push a 65y0m claim past twelve.
     80|       expect(annualSocialSecurityPayableMonths(inputs.ageInClaimYear!,…
       |                                                                                                   ^
     81|       expect(annualSocialSecurityPayableMonths(inputs.ageInClaimYear!,…
     82|     })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/annualSocialSecurity.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/annualSocialSecurity.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
