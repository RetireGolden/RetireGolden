# Mutation receipt: aca-household-magi-composition

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eight` at base `989fc81b`, and re-executed 2026-09-22 against RetireGolden base `a046c8f0` (branch `claude/b1-p4-cards-eight`, pull request #728), and re-executed 2026-09-27 against RetireGolden base `a5d07d32` (branch `claude/aca-2027-coverage-year`; no pull request is open yet) in `packages/engine`.

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

Re-executed after the IRS rounding change added the rounding case to the evidence file. The baseline is green (aca.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine7/packages/engine

 ❯ src/tax/aca.evidence.test.ts (14 tests | 1 failed) 7ms
   ❯ aca-household-magi-composition — ACA household MAGI composition (3)
     × sums 50,000 + 15,000 + 1,000 + 2,000 + 3,000 into a 71,000 actionable household MAGI 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 13 passed (14)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/tax/aca.evidence.test.ts > aca-household-magi-composition — ACA household MAGI composition > sums 50,000 + 15,000 + 1,000 + 2,000 + 3,000 into a 71,000 actionable household MAGI
AssertionError: magi 76000 is not within "exact" of the worksheet's 71000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/tax/aca.evidence.test.ts:28:5
     26|     withinTolerance(actual, expected, tolerance),
     27|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     28|   ).toBe(true)
       |     ^
     29| }
     30|
 ❯ src/tax/aca.evidence.test.ts:361:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/tax/aca.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/tax/aca.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
