# Mutation receipt: aca-allowable-premium-tax-credit

Executed 2026-09-18 against RetireGolden base `989fc81b` (branch claude/b1-p4-cards-slice-eight) in `packages/engine`.

## Mutation applied to `packages/engine/src/tax/aca.ts`

```diff
@@ -205,7 +205,7 @@ export function acaEconomicPremiumByMonth(
     const enrollment = Math.max(0, enrollmentPremiums[month] ?? 0)
     const benchmark = Math.max(0, slcspBenchmarkPremiums[month] ?? 0)
     if (enrollment <= 0 || benchmark <= 0) continue
-    modeledAllowablePtc += Math.min(enrollment, Math.max(0, benchmark - expectedContribution / 12))
+    modeledAllowablePtc += Math.min(enrollment, Math.max(0, enrollment - expectedContribution / 12))
   }
   const economicNetPremium = grossEnrollmentPremium - modeledAllowablePtc
   return {
```

This subtracts the expected contribution from the enrollment premium rather than the SLCSP benchmark, publishing $7,208.20 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/tax/aca.evidence.test.ts
```

## Captured failing output

```
FAIL  src/tax/aca.evidence.test.ts > aca-allowable-premium-tax-credit — ACA modeled allowable premium tax credit > credits the 12,000 benchmark less the 2,791.80 contribution, under the 10,000 enrollment cap
AssertionError: modeledAllowablePtc 7208.200000000001 is not within {"abs":0.005} of the worksheet's 9208.2: expected false to be true // Object.is equality

FAIL  src/tax/aca.evidence.test.ts > aca-allowable-premium-tax-credit — ACA modeled allowable premium tax credit > caps the credit at the enrollment premium when the benchmark is dearer than the plan bought
AssertionError: modeledAllowablePtc 0 is not within {"abs":0.005} of the worksheet's 2000: expected false to be true // Object.is equality

FAIL  src/tax/aca.evidence.test.ts > aca-allowable-premium-tax-credit — ACA modeled allowable premium tax credit > floors the credit at zero when the contribution exceeds the benchmark
AssertionError: expected 1633.5999999999985 to be +0 // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/tax/aca.ts`, then `git diff --quiet -- packages/engine/src/tax/aca.ts` exited 0, confirming no change to production code after the run.
