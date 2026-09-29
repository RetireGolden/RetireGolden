# Mutation receipt: survivor-reduction-entitlement-month

Executed 2026-09-27 against RetireGolden base `15478aa9` (branch `claude/social-security-law-2`; no pull request is open yet) for the new record under decision D-SS-LAW-2, and re-executed 2026-09-27 against RetireGolden base `4dd40692` (branch `claude/social-security-law-2`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `b338e430` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `8ccc9f8f` (branch `claude/ss-analysis-earnings-test`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/socialSecurity/survivorBenefit.ts`

```diff
diff --git a/packages/engine/src/socialSecurity/survivorBenefit.ts b/packages/engine/src/socialSecurity/survivorBenefit.ts
index 5c18cee8..6401100a 100644
--- a/packages/engine/src/socialSecurity/survivorBenefit.ts
+++ b/packages/engine/src/socialSecurity/survivorBenefit.ts
@@ -164,7 +164,7 @@ export function widowEntitlementAgeMonths(
   deathYear: number,
   survivorOwnClaimMonths: number,
 ): number {
-  return Math.max(survivorOwnClaimMonths, attainedAgeMonthsInMonth(survivorDob, deathYear + 1, 1))
+  return survivorOwnClaimMonths
 }
 
 /** Convenience: a deceased claim age of "at/after FRA" (no early reduction, no DRCs). */
```

This reduces the widow(er) benefit at the survivor's own claim age, the reading the engine used until 2026-09-27 (the worksheet's first wrong reading): case A publishes $19,114.29 and case B $24,848.57.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualSocialSecurity.survivorEntitlement.evidence.test.ts
```

## Captured failing output

The Social Security year moved into one function the ledger and the analysis models share, with the earnings test charged month by month (decision D-SS-ANALYSIS-EARNINGS-TEST), so the mutation is re-executed on that code. The baseline is green (annualSocialSecurity.survivorEntitlement.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/projection/internal/annualSocialSecurity.survivorEntitlement.evidence.test.ts (6 tests | 5 failed) 92ms
   ❯ survivor-reduction-entitlement-month — Widow(er) reduction from the first month of widow(er) entitlement (6)
     × entitlement ages: the later of the own claim and the January after the year of death (775, 772, 792) 4ms
     × case A: the survivor is reduced at her age in January 2029, then held to the limit (19,800, not 15,769.29) 45ms
     × case B: first paid as a widow at 772 months, the survivor is paid the 2,145 limit (25,740, not 20,500.07) 11ms
     × case D: months withheld from her own benefit before the death are not credited to the widow(er) benefit 11ms
     × case E: months withheld from the widow(er) benefit are credited from the survivor full-retirement-age month 10ms

 Test Files  1 failed (1)
      Tests  5 failed | 1 passed (6)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 5 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/annualSocialSecurity.survivorEntitlement.evidence.test.ts > survivor-reduction-entitlement-month — Widow(er) reduction from the first month of widow(er) entitlement > entitlement ages: the later of the own claim and the January after the year of death (775, 772, 792)
AssertionError: expected 744 to be 775 // Object.is equality

- Expected
+ Received

- 775
+ 744

 ❯ src/projection/internal/annualSocialSecurity.survivorEntitlement.evidence.test.ts:92:87
     90|     it('entitlement ages: the later of the own claim and the January a…
     91|       expect(attainedAgeMonthsInMonth({ year: 1964, month: 6, day: 15 …
     92|       expect(widowEntitlementAgeMonths({ year: 1964, month: 6, day: 15…
       |                                                                                       ^
     93|       expect(widowEntitlementAgeMonths({ year: 1962, month: 9, day: 20…
     94|       expect(widowEntitlementAgeMonths({ year: 1962, month: 9, day: 20…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/5]⎯

 FAIL  src/projection/internal/annualSocialSecurity.survivorEntitlement.evidence.test.ts > survivor-reduction-entitlement-month — Widow(er) reduction from the first month of widow(er) entitlement > case A: the survivor is reduced at her age in January 2029, then held to the limit (19,800, not 15,769.29)
AssertionError: caseA 19114.285714285714 is not within 0.005 of the worksheet's 19800: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/annualSocialSecurity.survivorEntitlement.evidence.test.ts:52:5
     50|     withinTolerance(actual, expected, { abs: 0.005 }),
     51|     `${label} ${actual} is not within 0.005 of the worksheet's ${expec…
     52|   ).toBe(true)
       |     ^
     53| }
     54|
 ❯ src/projection/internal/annualSocialSecurity.survivorEntitlement.evidence.test.ts:102:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/5]⎯

 FAIL  src/projection/internal/annualSocialSecurity.survivorEntitlement.evidence.test.ts > survivor-reduction-entitlement-month — Widow(er) reduction from the first month of widow(er) entitlement > case B: first paid as a widow at 772 months, the survivor is paid the 2,145 limit (25,740, not 20,500.07)
AssertionError: caseB 24848.571428571428 is not within 0.005 of the worksheet's 25740: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/annualSocialSecurity.survivorEntitlement.evidence.test.ts:52:5
     50|     withinTolerance(actual, expected, { abs: 0.005 }),
     51|     `${label} ${actual} is not within 0.005 of the worksheet's ${expec…
     52|   ).toBe(true)
       |     ^
     53| }
     54|
 ❯ src/projection/internal/annualSocialSecurity.survivorEntitlement.evidence.test.ts:108:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/5]⎯

 FAIL  src/projection/internal/annualSocialSecurity.survivorEntitlement.evidence.test.ts > survivor-reduction-entitlement-month — Widow(er) reduction from the first month of widow(er) entitlement > case D: months withheld from her own benefit before the death are not credited to the widow(er) benefit
AssertionError: caseD 2027 24848.571428571428 is not within 0.005 of the worksheet's 27812.57: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/annualSocialSecurity.survivorEntitlement.evidence.test.ts:52:5
     50|     withinTolerance(actual, expected, { abs: 0.005 }),
     51|     `${label} ${actual} is not within 0.005 of the worksheet's ${expec…
     52|   ).toBe(true)
       |     ^
     53| }
     54|
 ❯ src/projection/internal/annualSocialSecurity.survivorEntitlement.evidence.test.ts:120:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/5]⎯

 FAIL  src/projection/internal/annualSocialSecurity.survivorEntitlement.evidence.test.ts > survivor-reduction-entitlement-month — Widow(er) reduction from the first month of widow(er) entitlement > case E: months withheld from the widow(er) benefit are credited from the survivor full-retirement-age month
AssertionError: caseE 25272 is not within 0.005 of the worksheet's 28236: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/annualSocialSecurity.survivorEntitlement.evidence.test.ts:52:5
     50|     withinTolerance(actual, expected, { abs: 0.005 }),
     51|     `${label} ${actual} is not within 0.005 of the worksheet's ${expec…
     52|   ).toBe(true)
       |     ^
     53| }
     54|
 ❯ src/projection/internal/annualSocialSecurity.survivorEntitlement.evidence.test.ts:127:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/5]⎯
```

## Revert

The original bytes of `packages/engine/src/socialSecurity/survivorBenefit.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/socialSecurity/survivorBenefit.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
