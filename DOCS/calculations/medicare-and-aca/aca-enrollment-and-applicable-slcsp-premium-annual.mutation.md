# Mutation receipt: aca-enrollment-and-applicable-slcsp-premium-annual

Executed 2026-09-18 against RetireGolden base `1452ae11` (branch `claude/b1-p4-cards-slice-thirteen`) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualHealthcareExpenses.ts`

```diff
diff --git a/packages/engine/src/projection/internal/annualHealthcareExpenses.ts b/packages/engine/src/projection/internal/annualHealthcareExpenses.ts
index fd89dfb7..313a426d 100644
--- a/packages/engine/src/projection/internal/annualHealthcareExpenses.ts
+++ b/packages/engine/src/projection/internal/annualHealthcareExpenses.ts
@@ -234,7 +234,7 @@ export function annualHealthcareExpenses(
         const enrollmentPremium =
           member.enrollmentPremiumByMonth[month] ?? 0
         acaEnrollmentPremiums[month]! += enrollmentPremium
-        if (enrollmentPremium > 0) {
+        if (enrollmentPremium >= 0) {
           acaSlcspBenchmarkPremiums[month]! +=
             member.slcspBenchmarkPremiumByMonth[month] ?? 0
         }
```

Count a month's SLCSP benchmark whenever the enrollment premium is non-negative rather than above zero, which admits every unenrolled month. April's $600 benchmark, quoted behind no enrollment, now counts: the applicable benchmark becomes $2,400 instead of $1,800 — the worksheet's first wrong reading exactly. Gross enrollment is untouched, which is the point: the two totals are different sums over the same twelve months.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/types/aca.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and cache-hint lines were removed. Exit code: 1.

```

 RUN  v5.0.0 C:/TEMP/rg-s13/packages/engine

 ❯ src/projection/internal/types/aca.evidence.test.ts (2 tests | 1 failed) 31ms
   ❯ aca-enrollment-and-applicable-slcsp-premium-annual — ACA gross enrollment premium and applicable SLCSP benchmark (2)
     × sums three enrolled months of premium and three of benchmark, excluding April 29ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/types/aca.evidence.test.ts > aca-enrollment-and-applicable-slcsp-premium-annual — ACA gross enrollment premium and applicable SLCSP benchmark > sums three enrolled months of premium and three of benchmark, excluding April
AssertionError: applicableSlcspPremium 2400 is not within {"abs":0.005} of 1800: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/types/aca.evidence.test.ts:85:9
     83|         withinTolerance(actual, target, example.tolerance),
     84|         `${label} ${actual} is not within ${JSON.stringify(example.tol…
     85|       ).toBe(true)
       |         ^
     86|     }
     87|
 ❯ src/projection/internal/types/aca.evidence.test.ts:130:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed (1)
      Tests  1 failed | 1 passed (2)
```

## Revert

`git checkout -- packages/engine/src/projection/internal/annualHealthcareExpenses.ts` restored the file, and `git diff --quiet -- packages/engine/src/projection/internal/annualHealthcareExpenses.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the named file passed again (2 passed, exit 0).
