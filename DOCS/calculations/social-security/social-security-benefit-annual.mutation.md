# Mutation receipt: social-security-benefit-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-thirteen` at base `1452ae11`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualSocialSecurity.ts`

```diff
diff --git a/packages/engine/src/projection/internal/annualSocialSecurity.ts b/packages/engine/src/projection/internal/annualSocialSecurity.ts
index 271d0d7b..ac504a63 100644
--- a/packages/engine/src/projection/internal/annualSocialSecurity.ts
+++ b/packages/engine/src/projection/internal/annualSocialSecurity.ts
@@ -405,7 +405,7 @@ export function annualSocialSecurity(
     const fraYears = fraForBirthYear(effectiveBirthYear(y, m, d)).years
     let withheld = 0
     if (s.ageAttained < fraYears) {
-      withheld = Math.max(0, (wages - pack.socialSecurity.earningsTestBelowFraAnnual * limitGrowth) / 2)
+      withheld = Math.max(0, (wages - pack.socialSecurity.earningsTestBelowFraAnnual * limitGrowth) / 3)
     } else if (s.ageAttained === fraYears) {
       withheld = Math.max(0, (wages - pack.socialSecurity.earningsTestFraYearAnnual * limitGrowth) / 3)
     }
```

Divide the below-FRA excess wages by 3 instead of 2 — the worksheet's third wrong reading, which borrows the FRA-year rule for a year before FRA. Withholding falls to $3,333.33 (and the paid benefit rises to $20,666.67) instead of the $5,000 and $19,000 the below-FRA branch owes.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualSocialSecurity.benefitAnnual.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #730: the branch was renamed for the pull request, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (annualSocialSecurity.benefitAnnual.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/internal/annualSocialSecurity.benefitAnnual.evidence.test.ts (4 tests | 1 failed) 37ms
   ❯ social-security-benefit-annual — Annual household Social Security benefit (4)
     × withholds half the excess wages below FRA, paying 19000 of a 24000 benefit 5ms

 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)

  Transform  transforming modules took 2.37s · 44% of tracked time, re-done on every run
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

The original bytes of `packages/engine/src/projection/internal/annualSocialSecurity.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/annualSocialSecurity.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
