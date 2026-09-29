# Mutation receipt: social-security-payable-months

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eight` at base `989fc81b`, and re-executed 2026-09-22 against RetireGolden base `a046c8f0` (branch `claude/b1-p4-cards-eight`, pull request #728), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `15478aa9` (branch `claude/social-security-law-2`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `5f917180` (branch `claude/social-security-law-2`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `4dd40692` (branch `claude/social-security-law-2`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `c9e60e7c` (branch `claude/social-security-law-2`, pull request #755), and re-executed 2026-09-27 against RetireGolden base `32763d9d` (branch `claude/ssdi-month-and-roth-clock`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `6628b1c8` (branch `claude/ssdi-month-and-roth-clock`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `4fde8e43` (branch `claude/ssdi-month-and-roth-clock`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `96da3ad0` (branch `claude/ssdi-month-and-roth-clock`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `1d8256cf` (branch `claude/ssdi-month-and-roth-clock`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `df4b4cbf` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `719afc7f` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `8de4a471` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `8ccc9f8f` (branch `claude/ss-analysis-earnings-test`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/socialSecurity/householdYear.ts`

```diff
diff --git a/packages/engine/src/socialSecurity/householdYear.ts b/packages/engine/src/socialSecurity/householdYear.ts
index 99617552..f15b1527 100644
--- a/packages/engine/src/socialSecurity/householdYear.ts
+++ b/packages/engine/src/socialSecurity/householdYear.ts
@@ -97,7 +97,7 @@ export function annualSocialSecurityPayableMonths(
 ): number {
   if (ageAttained < claimAge.years) return 0
   if (ageAttained > claimAge.years) return 12
-  return Math.max(0, 12 - claimAge.months)
+  return Math.max(0, 13 - claimAge.months)
 }
 
 /**
```

This includes the claim month itself, paying 9 months in the claim year, the worksheet's first wrong reading. The payable months moved with the year's composition into socialSecurity/householdYear.ts (decision D-SS-ANALYSIS-EARNINGS-TEST), which the ledger calls through projection/internal/annualSocialSecurity.ts, so the mutation is applied there.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualSocialSecurity.evidence.test.ts
```

## Captured failing output

The Social Security year moved into one function the ledger and the analysis models share, with the earnings test charged month by month (decision D-SS-ANALYSIS-EARNINGS-TEST), so the mutation is re-executed on that code. The baseline is green (annualSocialSecurity.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/projection/internal/annualSocialSecurity.evidence.test.ts (4 tests | 2 failed) 35ms
   ❯ social-security-payable-months — Social Security payable months (2)
     × pays 0, then 8, then 12 months around a 65y4m claim 5ms
     × excludes the claim month itself, so a whole-year claim pays all twelve 1ms

 Test Files  1 failed (1)
      Tests  2 failed | 2 passed (4)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/annualSocialSecurity.evidence.test.ts > social-security-payable-months — Social Security payable months > pays 0, then 8, then 12 months around a 65y4m claim
AssertionError: claimYear 9 is not within "exact" of the worksheet's 8: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/annualSocialSecurity.evidence.test.ts:23:5
     21|     withinTolerance(actual, expected, tolerance),
     22|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     23|   ).toBe(true)
       |     ^
     24| }
     25|
 ❯ src/projection/internal/annualSocialSecurity.evidence.test.ts:61:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/projection/internal/annualSocialSecurity.evidence.test.ts > social-security-payable-months — Social Security payable months > excludes the claim month itself, so a whole-year claim pays all twelve
AssertionError: expected 13 to be 12 // Object.is equality

- Expected
+ Received

- 12
+ 13

 ❯ src/projection/internal/annualSocialSecurity.evidence.test.ts:78:99
     76|       // The first wrong reading would pay 9 months here; including th…
     77|       // month would also push a 65y0m claim past twelve.
     78|       expect(annualSocialSecurityPayableMonths(inputs.ageInClaimYear!,…
       |                                                                                                   ^
     79|       expect(annualSocialSecurityPayableMonths(inputs.ageInClaimYear!,…
     80|     })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/socialSecurity/householdYear.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/socialSecurity/householdYear.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
