# Mutation receipt: spending-healthcare-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-thirteen` at base `1452ae11`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `54306786` (branch `claude/mc-provenance-and-seed`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `6905169c` (branch `claude/people-order-and-scenarios`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `50327f81` (branch `claude/scrub-local-paths`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualHealthcareExpenses.ts`

```diff
diff --git a/packages/engine/src/projection/internal/annualHealthcareExpenses.ts b/packages/engine/src/projection/internal/annualHealthcareExpenses.ts
index 126d49e1..a47aaba5 100644
--- a/packages/engine/src/projection/internal/annualHealthcareExpenses.ts
+++ b/packages/engine/src/projection/internal/annualHealthcareExpenses.ts
@@ -203,7 +203,7 @@ export function annualHealthcareExpenses(
         )
       }
       const premium =
-        (medicare.partBAnnual + medicare.partDSurchargeAnnual) *
+        (medicare.partBAnnual + medicare.partDSurchargeAnnual) * healthInflFactor *
         (medicareMonths / 12)
       medicarePremiums += premium
       irmaaSurcharge +=
```

Scale the tier-priced Medicare premium by the healthcare inflation factor from the START year, on top of the factor from the pack year it already carries — the worksheet's first wrong reading. The twelve-month person is charged $3,940.992 of premium instead of $3,582.72, the eight-Medicare-month person $2,627.328 instead of $2,388.48, and the household $6,568.32 instead of $5,971.20, so every per-person component and the household total move.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualHealthcareExpenses.spendingHealthcare.evidence.test.ts
```

## Captured failing output

Re-executed after the engine began reading CMS's published IRMAA tier premiums (2026-09-29): the evidence test gained a case per tier and new figures, which moved the lines, titles or counts this receipt quotes; the mutation is unchanged. The baseline is green (annualHealthcareExpenses.spendingHealthcare.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/projection/internal/annualHealthcareExpenses.spendingHealthcare.evidence.test.ts (3 tests | 3 failed) 38ms
   ❯ spending-healthcare-annual — Annual healthcare expense: Medicare, extras and marketplace premiums (3)
     × charges the first person 4243.20: twelve Medicare months of tier premium plus scaled extras 31ms
     × charges the second person 4588.80: 1760 of marketplace beside 2828.80 of Medicare 3ms
     × adds the two people to 8832.00 on one household plan 3ms

 Test Files  1 failed (1)
      Tests  3 failed (3)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/annualHealthcareExpenses.spendingHealthcare.evidence.test.ts > spending-healthcare-annual — Annual healthcare expense: Medicare, extras and marketplace premiums > charges the first person 4243.20: twelve Medicare months of tier premium plus scaled extras
AssertionError: medicarePremiums 3941.5200000000004 is not within {"abs":0.005} of 3583.2: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/annualHealthcareExpenses.spendingHealthcare.evidence.test.ts:105:9
    103|         withinTolerance(actual, target, example.tolerance),
    104|         `${label} ${actual} is not within ${JSON.stringify(example.tol…
    105|       ).toBe(true)
       |         ^
    106|     }
    107|
 ❯ src/projection/internal/annualHealthcareExpenses.spendingHealthcare.evidence.test.ts:150:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  src/projection/internal/annualHealthcareExpenses.spendingHealthcare.evidence.test.ts > spending-healthcare-annual — Annual healthcare expense: Medicare, extras and marketplace premiums > charges the second person 4588.80: 1760 of marketplace beside 2828.80 of Medicare
AssertionError: medicarePremiums over the eight Medicare months 2627.6800000000003 is not within {"abs":0.005} of 2388.7999999999997: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/annualHealthcareExpenses.spendingHealthcare.evidence.test.ts:105:9
    103|         withinTolerance(actual, target, example.tolerance),
    104|         `${label} ${actual} is not within ${JSON.stringify(example.tol…
    105|       ).toBe(true)
       |         ^
    106|     }
    107|
 ❯ src/projection/internal/annualHealthcareExpenses.spendingHealthcare.evidence.test.ts:171:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  src/projection/internal/annualHealthcareExpenses.spendingHealthcare.evidence.test.ts > spending-healthcare-annual — Annual healthcare expense: Medicare, extras and marketplace premiums > adds the two people to 8832.00 on one household plan
AssertionError: household medicarePremiums 6569.200000000001 is not within {"abs":0.005} of 5972: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/annualHealthcareExpenses.spendingHealthcare.evidence.test.ts:105:9
    103|         withinTolerance(actual, target, example.tolerance),
    104|         `${label} ${actual} is not within ${JSON.stringify(example.tol…
    105|       ).toBe(true)
       |         ^
    106|     }
    107|
 ❯ src/projection/internal/annualHealthcareExpenses.spendingHealthcare.evidence.test.ts:197:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/annualHealthcareExpenses.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/annualHealthcareExpenses.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
