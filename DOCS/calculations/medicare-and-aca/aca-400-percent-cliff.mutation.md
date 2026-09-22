# Mutation receipt: aca-400-percent-cliff

Executed 2026-09-18 against RetireGolden base `989fc81b` (branch claude/b1-p4-cards-slice-eight) in `packages/engine`.

## Mutation applied to `packages/engine/src/tax/aca.ts`

```diff
@@ -186,7 +186,7 @@ export function acaEconomicPremiumByMonth(
   )
   const fpl = acaFederalPovertyLine(pack, householdSize, region, fplScale)
   const fplPct = fpl > 0 ? (magi / fpl) * 100 : Infinity
-  const overCliff = fplPct > pack.aca.maxFplPctForCredit
+  const overCliff = fplPct >= pack.aca.maxFplPctForCredit
   const belowEligibilityFloor = fplPct < pack.aca.minFplPctForCredit
 
   if (overCliff || belowEligibilityFloor || grossEnrollmentPremium <= 0 || applicableSlcspPremium <= 0) {
```

This makes the 400% ceiling exclusive, so a household at exactly 400% of the poverty line is over the cliff and gets no credit — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/tax/aca.evidence.test.ts
```

## Captured failing output

```
FAIL  src/tax/aca.evidence.test.ts > aca-400-percent-cliff — ACA 400% FPL cliff > allows the credit at exactly 400% of the poverty line
AssertionError: expected true to be false // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/tax/aca.ts`, then `git diff --quiet -- packages/engine/src/tax/aca.ts` exited 0, confirming no change to production code after the run.
