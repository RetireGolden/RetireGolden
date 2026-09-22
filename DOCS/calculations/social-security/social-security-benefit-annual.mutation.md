# Mutation receipt: social-security-benefit-annual

Executed 2026-09-18 against RetireGolden base `1452ae11` (branch `claude/b1-p4-cards-slice-thirteen`) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualSocialSecurity.ts`

```diff
diff --git a/packages/engine/src/projection/internal/annualSocialSecurity.ts b/packages/engine/src/projection/internal/annualSocialSecurity.ts
index b0a5e41e..af6655b0 100644
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

Re-executed 2026-09-18 against base `e522ddfb`, after the worksheet was re-derived (the current-spouse candidate is own monthly plus the capped excess, $36,000; the claim year is a realizable 64y3m claim on a 1960 birth, whose 49/60 factor and nine payable months come from the same claim age) and its fixture rebuilt around those values. The same mutation still fails, and it is now the ONLY failure: the two-person case that the first derivation disclosed as a discrepancy passes, so no deliberately red test remains and the baseline is green. Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and cache-hint lines were removed. Exit code: 1.

```

 RUN  v5.0.0 C:/TEMP/rg-s13/packages/engine

 ❯ src/projection/internal/annualSocialSecurity.benefitAnnual.evidence.test.ts (4 tests | 1 failed) 35ms
   ❯ social-security-benefit-annual — Annual household Social Security benefit (4)
     × withholds half the excess wages below FRA, paying 19000 of a 24000 benefit 5ms

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


 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)
```

## Revert

`git checkout -- packages/engine/src/projection/internal/annualSocialSecurity.ts` restored the file, and `git diff --quiet -- packages/engine/src/projection/internal/annualSocialSecurity.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the named file passed again (4 passed, exit 0).
