# Mutation receipt: aca-enrollment-and-applicable-slcsp-premium-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-thirteen` at base `1452ae11`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `54306786` (branch `claude/mc-provenance-and-seed`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `6905169c` (branch `claude/people-order-and-scenarios`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualHealthcareExpenses.ts`

```diff
diff --git a/packages/engine/src/projection/internal/annualHealthcareExpenses.ts b/packages/engine/src/projection/internal/annualHealthcareExpenses.ts
index 126d49e1..3a33cd65 100644
--- a/packages/engine/src/projection/internal/annualHealthcareExpenses.ts
+++ b/packages/engine/src/projection/internal/annualHealthcareExpenses.ts
@@ -233,7 +233,7 @@ export function annualHealthcareExpenses(
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

Re-executed because the independent review's fixes (M1 to L3) moved the production lines or the evidence test lines this receipt quotes; the mutation is unchanged. The baseline is green (aca.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine19/packages/engine

 ❯ src/projection/internal/types/aca.evidence.test.ts (2 tests | 1 failed) 34ms
   ❯ aca-enrollment-and-applicable-slcsp-premium-annual — ACA gross enrollment premium and applicable SLCSP benchmark (2)
     × sums three enrolled months of premium and three of benchmark, excluding April 31ms

 Test Files  1 failed (1)
      Tests  1 failed | 1 passed (2)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/types/aca.evidence.test.ts > aca-enrollment-and-applicable-slcsp-premium-annual — ACA gross enrollment premium and applicable SLCSP benchmark > sums three enrolled months of premium and three of benchmark, excluding April
AssertionError: applicableSlcspPremium 2400 is not within {"abs":0.005} of 1800: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/types/aca.evidence.test.ts:84:9
     82|         withinTolerance(actual, target, example.tolerance),
     83|         `${label} ${actual} is not within ${JSON.stringify(example.tol…
     84|       ).toBe(true)
       |         ^
     85|     }
     86|
 ❯ src/projection/internal/types/aca.evidence.test.ts:129:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/annualHealthcareExpenses.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/annualHealthcareExpenses.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
