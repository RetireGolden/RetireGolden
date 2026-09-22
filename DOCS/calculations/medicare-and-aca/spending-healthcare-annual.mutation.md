# Mutation receipt: spending-healthcare-annual

Executed 2026-09-18 against RetireGolden base `1452ae11` (branch `claude/b1-p4-cards-slice-thirteen`) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualHealthcareExpenses.ts`

```diff
diff --git a/packages/engine/src/projection/internal/annualHealthcareExpenses.ts b/packages/engine/src/projection/internal/annualHealthcareExpenses.ts
index fd89dfb7..bb842cc7 100644
--- a/packages/engine/src/projection/internal/annualHealthcareExpenses.ts
+++ b/packages/engine/src/projection/internal/annualHealthcareExpenses.ts
@@ -174,7 +174,7 @@ export function annualHealthcareExpenses(
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

Re-executed 2026-09-18 against base `e522ddfb`, after the worksheet was re-derived (the second person's four marketplace months carry the complementary eight Medicare months, so the household is one real plan whose total is $8,831.20) and its fixture rebuilt: each person's component on that person's own plan, and the total on a two-person household plan. The same mutation still fails, on all three tests. The baseline is green: `annualHealthcareExpenses.spendingHealthcare.evidence.test.ts` passes on unmodified production, so no deliberately red test remains. Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and cache-hint lines were removed. Exit code: 1.

```

 RUN  v5.0.0 C:/TEMP/rg-s13/packages/engine

 ❯ src/projection/internal/annualHealthcareExpenses.spendingHealthcare.evidence.test.ts (3 tests | 3 failed) 33ms
   ❯ spending-healthcare-annual — Annual healthcare expense: Medicare, extras and marketplace premiums (3)
     × charges the first person 4242.72: twelve Medicare months of tier premium plus scaled extras 28ms
     × charges the second person 4588.48: 1760 of marketplace beside 2828.48 of Medicare 2ms
     × adds the two people to 8831.20 on one household plan 3ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/annualHealthcareExpenses.spendingHealthcare.evidence.test.ts > spending-healthcare-annual — Annual healthcare expense: Medicare, extras and marketplace premiums > charges the first person 4242.72: twelve Medicare months of tier premium plus scaled extras
AssertionError: medicarePremiums 3940.9920000000006 is not within {"abs":0.005} of 3582.72: expected false to be true // Object.is equality

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

 FAIL  src/projection/internal/annualHealthcareExpenses.spendingHealthcare.evidence.test.ts > spending-healthcare-annual — Annual healthcare expense: Medicare, extras and marketplace premiums > charges the second person 4588.48: 1760 of marketplace beside 2828.48 of Medicare
AssertionError: medicarePremiums over the eight Medicare months 2627.3280000000004 is not within {"abs":0.005} of 2388.48: expected false to be true // Object.is equality

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

 FAIL  src/projection/internal/annualHealthcareExpenses.spendingHealthcare.evidence.test.ts > spending-healthcare-annual — Annual healthcare expense: Medicare, extras and marketplace premiums > adds the two people to 8831.20 on one household plan
AssertionError: household medicarePremiums 6568.3200000000015 is not within {"abs":0.005} of 5971.2: expected false to be true // Object.is equality

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


 Test Files  1 failed (1)
      Tests  3 failed (3)
```

## Revert

`git checkout -- packages/engine/src/projection/internal/annualHealthcareExpenses.ts` restored the file, and `git diff --quiet -- packages/engine/src/projection/internal/annualHealthcareExpenses.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the named file passed again (3 passed, exit 0).
