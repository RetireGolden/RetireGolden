# Mutation receipt: relocation-state-tax-driver-savings

Executed 2026-09-18 against RetireGolden base `74916a7e` (branch `claude/b1-p4-cards-slice-seven`) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/relocation.ts`

```diff
diff --git a/packages/engine/src/projection/relocation.ts b/packages/engine/src/projection/relocation.ts
index 2f70ba31..0a09cbd6 100644
--- a/packages/engine/src/projection/relocation.ts
+++ b/packages/engine/src/projection/relocation.ts
@@ -389,7 +389,7 @@ function computeDrivers(
   return {
     facts,
     totalStateLocalTax: total,
-    ssTreatmentSavings: ssVariant.sum - total,
+    ssTreatmentSavings: total - ssVariant.sum,
     retirementExclusionSavings: retirementVariant.sum - total,
     publicPensionExclusionSavings: publicVariant.sum - total,
     capitalGainsTreatmentSavings: capitalGainsVariant.sum - total,
```

Reverse the counterfactual subtraction for the Social Security driver.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/relocation.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-s7/packages/engine

 ❯ src/projection/relocation.evidence.test.ts (2 tests | 1 failed) 37ms
   ❯ relocation-state-tax-driver-savings — Relocation state tax driver savings (1)
     × attributes 1300, 1800, 550 and -150 from the one-at-a-time recomputations 7ms

 Test Files  1 failed (1)
      Tests  1 failed | 1 passed (2)

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/relocation.evidence.test.ts > relocation-state-tax-driver-savings — Relocation state tax driver savings > attributes 1300, 1800, 550 and -150 from the one-at-a-time recomputations
AssertionError: ssTreatmentSavings: actual -1300, worksheet 1300: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/relocation.evidence.test.ts:229:13
    227|             withinTolerance(actual, worksheet, example.tolerance),
    228|             `${String(field)}: actual ${actual}, worksheet ${worksheet…
    229|           ).toBe(true)
       |             ^
    230|         }
    231|         // The wrong reading: reversing the counterfactual subtraction.

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

`git checkout -- packages/engine/src/projection/relocation.ts` restored the exact original bytes (compared byte for byte in the harness), and `git diff --quiet -- packages/engine/src/projection/relocation.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the named file passed again (exit 0).
