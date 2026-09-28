# Mutation receipt: social-security-benefit-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-thirteen` at base `1452ae11`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `e2f92f05` (branch `claude/social-security-law-2`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `15478aa9` (branch `claude/social-security-law-2`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `5f917180` (branch `claude/social-security-law-2`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `4dd40692` (branch `claude/social-security-law-2`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `c9e60e7c` (branch `claude/social-security-law-2`, pull request #755), and re-executed 2026-09-27 against RetireGolden base `32763d9d` (branch `claude/ssdi-month-and-roth-clock`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `6628b1c8` (branch `claude/ssdi-month-and-roth-clock`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `4fde8e43` (branch `claude/ssdi-month-and-roth-clock`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `89c0fe4a` (branch `claude/ssdi-month-and-roth-clock`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `96da3ad0` (branch `claude/ssdi-month-and-roth-clock`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `1d8256cf` (branch `claude/ssdi-month-and-roth-clock`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `df4b4cbf` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `719afc7f` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `8de4a471` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/socialSecurity/earningsTest.ts`

```diff
diff --git a/packages/engine/src/socialSecurity/earningsTest.ts b/packages/engine/src/socialSecurity/earningsTest.ts
index 985c1ad7..45afdf0c 100644
--- a/packages/engine/src/socialSecurity/earningsTest.ts
+++ b/packages/engine/src/socialSecurity/earningsTest.ts
@@ -40,1 +40,1 @@
-    withheld = Math.max(0, (wages - belowFraExemptAnnual) / 2)
+    withheld = Math.max(0, (wages - belowFraExemptAnnual) / 3)
```

Divide the below-FRA excess wages by 3 instead of 2 — the worksheet's third wrong reading, which borrows the FRA-year rule for a year before FRA. The arithmetic moved from annualSocialSecurity.ts into socialSecurity/earningsTest.ts, which the ledger calls (B2-P1 slice 4's review, F2), so the mutation is applied there. Withholding falls to $3,333.33 (and the paid benefit rises to $20,666.67) instead of the $5,000 and $19,000 the below-FRA branch owes.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualSocialSecurity.benefitAnnual.evidence.test.ts
```

## Captured failing output

The merge of origin/main (#756) into the slice moved the lines around its hunk, and both sides had re-executed it, so it is re-executed on the merged code. The baseline is green (annualSocialSecurity.benefitAnnual.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine13/packages/engine

 ❯ src/projection/internal/annualSocialSecurity.benefitAnnual.evidence.test.ts (4 tests | 1 failed) 37ms
   ❯ social-security-benefit-annual — Annual household Social Security benefit (4)
     × withholds half the excess wages below FRA, paying 19000 of a 24000 benefit 5ms

 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/annualSocialSecurity.benefitAnnual.evidence.test.ts > social-security-benefit-annual — Annual household Social Security benefit > withholds half the excess wages below FRA, paying 19000 of a 24000 benefit
AssertionError: ssEarningsTestWithheld 3333.3333333333335 is not within {"abs":0.005} of 5000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/annualSocialSecurity.benefitAnnual.evidence.test.ts:78:9
     76|         withinTolerance(actual, target, example.tolerance),
     77|         `${label} ${actual} is not within ${JSON.stringify(example.tol…
     78|       ).toBe(true)
       |         ^
     79|     }
     80|
 ❯ src/projection/internal/annualSocialSecurity.benefitAnnual.evidence.test.ts:213:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/socialSecurity/earningsTest.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/socialSecurity/earningsTest.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
