# Mutation receipt: year-result-tax-exempt-interest

Executed 2026-09-18 against RetireGolden base `60e47fd8` (branch claude/b1-p4-cards-slice-eleven) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualAggregateRothConversionPhase.ts`

```diff
@@ -372,10 +372,8 @@
   // Cash and balances always follow generated only.
   const yearTaxExemptInterest =
     acaActive && acaContract?.taxExemptInterest.state === 'known'
-      ? Math.max(
-        Math.max(0, acaContract.taxExemptInterest.amount ?? 0),
-        generatedTaxExemptInterest,
-      )
+      ? Math.max(0, acaContract.taxExemptInterest.amount ?? 0) +
+        generatedTaxExemptInterest
       : generatedTaxExemptInterest
   const acaForeignExclusionAddback =
     acaActive && acaContract?.foreignExclusionAddback.state === 'known'
```

This adds the attested household total to the plan-generated subset instead of taking the greater, publishing $10,000 in the ACA-contract year — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/simulate.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/projection/simulate.evidence.test.ts > year-result-tax-exempt-interest — Annual tax-exempt interest, and the ACA-year maximum > publishes the larger attested 6000 in a known ACA contract year, never the sum
AssertionError: Case B taxExemptInterest 10000 is not within {"abs":0.005} of the worksheet's 6000: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/internal/annualAggregateRothConversionPhase.ts`, then `git diff --quiet -- packages/engine/src/projection/internal/annualAggregateRothConversionPhase.ts` exited 0, confirming no change to production code after the run.
