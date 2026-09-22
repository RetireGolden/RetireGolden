# Mutation receipt: tax-total-annual

Executed 2026-09-18 against RetireGolden base `60e47fd8` (branch claude/b1-p4-cards-slice-eleven) in `packages/engine`.

## Mutation applied to `packages/engine/src/tax/federalTax.ts`

```diff
@@ -706,7 +706,7 @@
   return {
     compute: (input) => {
       const { enriched, federal } = deriveFederalEnrichment(input)
-      return calculators.reduce((sum, calculator) => {
+      return calculators.slice(0, 1).reduce((sum, calculator) => {
         if (isUnmodifiedBuiltinFederalCalculator(calculator)) {
           return sum + federal.totalTax
         }
```

This composes only the first calculator, publishing $12,000 and omitting the state amount — the worksheet's third wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/tax/federalTax.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/tax/federalTax.evidence.test.ts > tax-total-annual — Annual composed tax > composes 12000 of federal and 3000 of state into 15000 and excludes penalties
AssertionError: composed tax 12000 is not within {"abs":0.005} of the worksheet's 15000: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/tax/federalTax.ts`, then `git diff --quiet -- packages/engine/src/tax/federalTax.ts` exited 0, confirming no change to production code after the run.
