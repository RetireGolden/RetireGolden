# Mutation receipt: aca-economic-net-premium

Executed 2026-09-18 against RetireGolden base `989fc81b` (branch claude/b1-p4-cards-slice-eight) in `packages/engine`.

## Mutation applied to `packages/engine/src/tax/aca.ts`

```diff
@@ -207,7 +207,7 @@ export function acaEconomicPremiumByMonth(
     if (enrollment <= 0 || benchmark <= 0) continue
     modeledAllowablePtc += Math.min(enrollment, Math.max(0, benchmark - expectedContribution / 12))
   }
-  const economicNetPremium = grossEnrollmentPremium - modeledAllowablePtc
+  const economicNetPremium = applicableSlcspPremium - modeledAllowablePtc
   return {
     fplPct,
     expectedContribution,
```

This subtracts the credit from the SLCSP benchmark rather than the gross enrollment premium, publishing $2,791.80 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/tax/aca.evidence.test.ts
```

## Captured failing output

```
FAIL  src/tax/aca.evidence.test.ts > aca-economic-net-premium — ACA economic net premium > bears 791.80 of the 10,000 gross premium after a 9,208.20 credit
AssertionError: economicNetPremium 2791.7999999999975 is not within {"abs":0.005} of the worksheet's 791.8: expected false to be true // Object.is equality

FAIL  src/tax/aca.evidence.test.ts > aca-economic-net-premium — ACA economic net premium > never falls below zero, because each month's credit is capped at that month's premium
AssertionError: expected 10800 to be +0 // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/tax/aca.ts`, then `git diff --quiet -- packages/engine/src/tax/aca.ts` exited 0, confirming no change to production code after the run.
