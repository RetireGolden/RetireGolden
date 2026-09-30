# Mutation receipt: dual-entitlement-composition

Executed 2026-09-27 against RetireGolden base `5f917180` (branch `claude/social-security-law-2`; no pull request is open yet) for the new record under decision D-SS-LAW-2, and re-executed 2026-09-27 against RetireGolden base `4dd40692` (branch `claude/social-security-law-2`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `c9e60e7c` (branch `claude/social-security-law-2`, pull request #755) in `packages/engine`.

## Mutation applied to `packages/engine/src/socialSecurity/dualEntitlement.ts`

```diff
diff --git a/packages/engine/src/socialSecurity/dualEntitlement.ts b/packages/engine/src/socialSecurity/dualEntitlement.ts
index ce71bbd4..7b713717 100644
--- a/packages/engine/src/socialSecurity/dualEntitlement.ts
+++ b/packages/engine/src/socialSecurity/dualEntitlement.ts
@@ -70,7 +70,7 @@ export function spouseDualEntitlementMonthly(input: SpouseDualEntitlementInput):
   const ownPia = Math.max(0, input.ownPiaMonthly)
   const own = Math.max(0, input.ownActualMonthly)
   const excess = Math.max(0, input.spouseBaseMonthly - ownPia)
-  return Math.max(own, Math.min(own, ownPia) + excess * input.spouseFactor)
+  return Math.max(own, input.spouseBaseMonthly * input.spouseFactor)
 }
 
 /**
```

This pays the larger of the own benefit and the reduced half, the rule the engine applied outside its guard and to every divorced spouse until 2026-09-27 (the worksheet's first wrong reading): case F publishes $1,250.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/socialSecurity/dualEntitlement.evidence.test.ts
```

## Captured failing output

Executed for the new record (decision D-SS-LAW-2): the mutation reverts the fix, paying the larger of the own benefit and the reduced half. Re-executed after the review of RetireGolden #755 added case I (an ex born in December after the 2nd, whose divorced-spouse benefit starts the next January) to the test; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (dualEntitlement.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/socialSecurity/dualEntitlement.evidence.test.ts (9 tests | 7 failed) 109ms
   ❯ dual-entitlement-composition — Own benefit plus the separately reduced spouse excess (9)
     × case A: a husband who claims at 70 starts her spouse benefit then, unreduced (960 a month, not 780) 46ms
     × case B: a divorced spouse is paid her own benefit plus the excess reduced when the ex is first 62 throughout a month (707.50, not 650) 12ms
     × case C: a husband who claims at 65 starts her spouse benefit at 763 months (781.67, not 715) 10ms
     × case D: the check's divorced case (867.50 a month, not 780) 9ms
     × case I: an ex born December 5 is first 62 throughout the next January, so the year the ex turns 62 pays only the own benefit (6,720, not 16,500) 17ms
     × case E: simultaneous early claims keep the reduced own plus reduced excess (16,080) 12ms
     × cases F, G and H: the helper, with an early own benefit and with delayed credits 0ms

 Test Files  1 failed (1)
      Tests  7 failed | 2 passed (9)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 7 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/socialSecurity/dualEntitlement.evidence.test.ts > dual-entitlement-composition — Own benefit plus the separately reduced spouse excess > case A: a husband who claims at 70 starts her spouse benefit then, unreduced (960 a month, not 780)
AssertionError: caseA claimant 14400 is not within 0.005 of the worksheet's 11520: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/socialSecurity/dualEntitlement.evidence.test.ts:73:5
     71|     withinTolerance(actual, expected, { abs: 0.005 }),
     72|     `${label} ${actual} is not within 0.005 of the worksheet's ${expec…
     73|   ).toBe(true)
       |     ^
     74| }
     75|
 ❯ src/socialSecurity/dualEntitlement.evidence.test.ts:138:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/7]⎯

 FAIL  src/socialSecurity/dualEntitlement.evidence.test.ts > dual-entitlement-composition — Own benefit plus the separately reduced spouse excess > case B: a divorced spouse is paid her own benefit plus the excess reduced when the ex is first 62 throughout a month (707.50, not 650)
AssertionError: caseB 8850 is not within 0.005 of the worksheet's 8490: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/socialSecurity/dualEntitlement.evidence.test.ts:73:5
     71|     withinTolerance(actual, expected, { abs: 0.005 }),
     72|     `${label} ${actual} is not within 0.005 of the worksheet's ${expec…
     73|   ).toBe(true)
       |     ^
     74| }
     75|
 ❯ src/socialSecurity/dualEntitlement.evidence.test.ts:160:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/7]⎯

 FAIL  src/socialSecurity/dualEntitlement.evidence.test.ts > dual-entitlement-composition — Own benefit plus the separately reduced spouse excess > case C: a husband who claims at 65 starts her spouse benefit at 763 months (781.67, not 715)
AssertionError: caseC claimant 9625 is not within 0.005 of the worksheet's 9380: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/socialSecurity/dualEntitlement.evidence.test.ts:73:5
     71|     withinTolerance(actual, expected, { abs: 0.005 }),
     72|     `${label} ${actual} is not within 0.005 of the worksheet's ${expec…
     73|   ).toBe(true)
       |     ^
     74| }
     75|
 ❯ src/socialSecurity/dualEntitlement.evidence.test.ts:166:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/7]⎯

 FAIL  src/socialSecurity/dualEntitlement.evidence.test.ts > dual-entitlement-composition — Own benefit plus the separately reduced spouse excess > case D: the check's divorced case (867.50 a month, not 780)
AssertionError: caseD 11400.000000000002 is not within 0.005 of the worksheet's 10410: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/socialSecurity/dualEntitlement.evidence.test.ts:73:5
     71|     withinTolerance(actual, expected, { abs: 0.005 }),
     72|     `${label} ${actual} is not within 0.005 of the worksheet's ${expec…
     73|   ).toBe(true)
       |     ^
     74| }
     75|
 ❯ src/socialSecurity/dualEntitlement.evidence.test.ts:173:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/7]⎯

 FAIL  src/socialSecurity/dualEntitlement.evidence.test.ts > dual-entitlement-composition — Own benefit plus the separately reduced spouse excess > case I: an ex born December 5 is first 62 throughout the next January, so the year the ex turns 62 pays only the own benefit (6,720, not 16,500)
AssertionError: caseI 2027 16300.000000000002 is not within 0.005 of the worksheet's 16500: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/socialSecurity/dualEntitlement.evidence.test.ts:73:5
     71|     withinTolerance(actual, expected, { abs: 0.005 }),
     72|     `${label} ${actual} is not within 0.005 of the worksheet's ${expec…
     73|   ).toBe(true)
       |     ^
     74| }
     75|
 ❯ src/socialSecurity/dualEntitlement.evidence.test.ts:186:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/7]⎯

 FAIL  src/socialSecurity/dualEntitlement.evidence.test.ts > dual-entitlement-composition — Own benefit plus the separately reduced spouse excess > case E: simultaneous early claims keep the reduced own plus reduced excess (16,080)
AssertionError: caseE 15600 is not within 0.005 of the worksheet's 16080: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/socialSecurity/dualEntitlement.evidence.test.ts:73:5
     71|     withinTolerance(actual, expected, { abs: 0.005 }),
     72|     `${label} ${actual} is not within 0.005 of the worksheet's ${expec…
     73|   ).toBe(true)
       |     ^
     74| }
     75|
 ❯ src/socialSecurity/dualEntitlement.evidence.test.ts:192:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[6/7]⎯

 FAIL  src/socialSecurity/dualEntitlement.evidence.test.ts > dual-entitlement-composition — Own benefit plus the separately reduced spouse excess > cases F, G and H: the helper, with an early own benefit and with delayed credits
AssertionError: caseF 1250 is not within 0.005 of the worksheet's 1283.33: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/socialSecurity/dualEntitlement.evidence.test.ts:73:5
     71|     withinTolerance(actual, expected, { abs: 0.005 }),
     72|     `${label} ${actual} is not within 0.005 of the worksheet's ${expec…
     73|   ).toBe(true)
       |     ^
     74| }
     75|
 ❯ src/socialSecurity/dualEntitlement.evidence.test.ts:199:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[7/7]⎯
```

## Revert

The original bytes of `packages/engine/src/socialSecurity/dualEntitlement.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/socialSecurity/dualEntitlement.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
