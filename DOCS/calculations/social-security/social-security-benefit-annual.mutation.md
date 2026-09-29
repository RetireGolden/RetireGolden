# Mutation receipt: social-security-benefit-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-thirteen` at base `1452ae11`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `e2f92f05` (branch `claude/social-security-law-2`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `15478aa9` (branch `claude/social-security-law-2`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `5f917180` (branch `claude/social-security-law-2`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `4dd40692` (branch `claude/social-security-law-2`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `c9e60e7c` (branch `claude/social-security-law-2`, pull request #755), and re-executed 2026-09-27 against RetireGolden base `32763d9d` (branch `claude/ssdi-month-and-roth-clock`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `6628b1c8` (branch `claude/ssdi-month-and-roth-clock`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `4fde8e43` (branch `claude/ssdi-month-and-roth-clock`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `89c0fe4a` (branch `claude/ssdi-month-and-roth-clock`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `96da3ad0` (branch `claude/ssdi-month-and-roth-clock`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `1d8256cf` (branch `claude/ssdi-month-and-roth-clock`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `df4b4cbf` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `719afc7f` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `8de4a471` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `8ccc9f8f` (branch `claude/ss-analysis-earnings-test`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `22f6f755` (branch `claude/ss-analysis-earnings-test`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/socialSecurity/earningsTest.ts`

```diff
diff --git a/packages/engine/src/socialSecurity/earningsTest.ts b/packages/engine/src/socialSecurity/earningsTest.ts
index acf0e452..a19fc8e1 100644
--- a/packages/engine/src/socialSecurity/earningsTest.ts
+++ b/packages/engine/src/socialSecurity/earningsTest.ts
@@ -89,7 +89,7 @@ export function excessEarnings(input: ExcessEarningsInput): number {
   const fraYear = Math.floor(fraMonthIndex / 12)
   let excess: number
   if (year < fraYear) {
-    excess = (wages - belowFraExemptAnnual) / 2
+    excess = (wages - belowFraExemptAnnual) / 3
   } else if (year === fraYear) {
     const monthsBefore = fraMonthIndex - year * 12
     if (monthsBefore <= 0) return 0
```

Divide the below-FRA excess wages by 3 instead of 2, the worksheet's third wrong reading, which borrows the FRA-year rule for a year before FRA. The excess is computed in socialSecurity/earningsTest.ts#excessEarnings, which the ledger's year function calls (decision D-SS-ANALYSIS-EARNINGS-TEST), so the mutation is applied there. Withholding falls to $3,333 (10,000/3 reduced to the dollar) and the paid benefit rises to $20,667, instead of the $5,000 and $19,000 the below-FRA branch owes; every family-charge and adjustment case (E5, E7b, E1), whose excess is also below FRA, moves with it.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualSocialSecurity.benefitAnnual.evidence.test.ts
```

## Captured failing output

After the implementation review, no month before a benefit's first month of entitlement is charged (403(f)(1)(A)) and switching adjusts a widow(er) benefit at 62, so the mutation is re-executed on that code. The baseline is green (annualSocialSecurity.benefitAnnual.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/projection/internal/annualSocialSecurity.benefitAnnual.evidence.test.ts (8 tests | 4 failed) 57ms
   ❯ social-security-benefit-annual — Annual household Social Security benefit (8)
     × withholds half the excess wages below FRA, paying 19000 of a 24000 benefit 6ms
     × charges a worker's excess against the spouse benefit on his record, the partial month two to one (E5) 6ms
     × charges her own excess against what is left of her benefits after his (E7b) 3ms
     × charges no month before entitlement and credits every month charged, from the full-retirement-age month (E1) 3ms

 Test Files  1 failed (1)
      Tests  4 failed | 4 passed (8)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/annualSocialSecurity.benefitAnnual.evidence.test.ts > social-security-benefit-annual — Annual household Social Security benefit > withholds half the excess wages below FRA, paying 19000 of a 24000 benefit
AssertionError: ssEarningsTestWithheld 3333 is not within {"abs":0.005} of 5000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/annualSocialSecurity.benefitAnnual.evidence.test.ts:88:9
     86|         withinTolerance(actual, target, example.tolerance),
     87|         `${label} ${actual} is not within ${JSON.stringify(example.tol…
     88|       ).toBe(true)
       |         ^
     89|     }
     90|
 ❯ src/projection/internal/annualSocialSecurity.benefitAnnual.evidence.test.ts:223:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/4]⎯

 FAIL  src/projection/internal/annualSocialSecurity.benefitAnnual.evidence.test.ts > social-security-benefit-annual — Annual household Social Security benefit > charges a worker's excess against the spouse benefit on his record, the partial month two to one (E5)
AssertionError: expected 7460 to be 2893.33 // Object.is equality

- Expected
+ Received

- 2893.33
+ 7460

 ❯ src/projection/internal/annualSocialSecurity.benefitAnnual.evidence.test.ts:269:32
    267|         2031,
    268|       )
    269|       expect(paid('p1', 2026)).toBe(value('E5 W paid, 2026'))
       |                                ^
    270|       expect(paid('p2', 2026)).toBe(value('E5 S paid, 2026'))
    271|       expect(paid('p1', 2031)).toBe(value('E5 W paid, 2031'))

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/4]⎯

 FAIL  src/projection/internal/annualSocialSecurity.benefitAnnual.evidence.test.ts > social-security-benefit-annual — Annual household Social Security benefit > charges her own excess against what is left of her benefits after his (E7b)
AssertionError: expected 7460 to be 2893.33 // Object.is equality

- Expected
+ Received

- 2893.33
+ 7460

 ❯ src/projection/internal/annualSocialSecurity.benefitAnnual.evidence.test.ts:288:32
    286|         2031,
    287|       )
    288|       expect(paid('p1', 2026)).toBe(value('E7b W paid, 2026'))
       |                                ^
    289|       expect(paid('p2', 2026)).toBe(value('E7b S paid, 2026'))
    290|       expect(paid('p2', 2031)).toBe(value('E7b S paid, 2031'))

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/4]⎯

 FAIL  src/projection/internal/annualSocialSecurity.benefitAnnual.evidence.test.ts > social-security-benefit-annual — Annual household Social Security benefit > charges no month before entitlement and credits every month charged, from the full-retirement-age month (E1)
AssertionError: expected 11627 to be 9040 // Object.is equality

- Expected
+ Received

- 9040
+ 11627

 ❯ src/projection/internal/annualSocialSecurity.benefitAnnual.evidence.test.ts:302:32
    300|         2032,
    301|       )
    302|       expect(paid('p1', 2026)).toBe(value('E1 paid, 2026'))
       |                                ^
    303|       expect(paid('p1', 2031)).toBe(value('E1 paid, 2031'))
    304|       expect(paid('p1', 2032)).toBe(value('E1 paid, 2032'))

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/4]⎯
```

## Revert

The original bytes of `packages/engine/src/socialSecurity/earningsTest.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/socialSecurity/earningsTest.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
