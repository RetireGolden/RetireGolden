# Mutation receipt: survivor-benefit-rib-lim

Executed 2026-09-18 against RetireGolden base `989fc81b` (branch claude/b1-p4-cards-slice-eight) in `packages/engine`.

## Mutation applied to `packages/engine/src/socialSecurity/survivorBenefit.ts`

```diff
@@ -69,7 +69,7 @@ export function survivorReductionFactor(ageMonths: number, survivorFraMonths: nu
  */
 export function survivorBenefitMonthly(input: SurvivorBenefitInput): number {
   if (input.deceasedPiaMonthly <= 0) return 0
-  const base = Math.max(input.deceasedActualMonthly, WIDOW_LIMIT_PIA_FRACTION * input.deceasedPiaMonthly)
+  const base = input.deceasedActualMonthly
   const ageMonths = input.survivorClaimAge.years * 12 + input.survivorClaimAge.months
   return base * survivorReductionFactor(ageMonths, input.survivorFraMonths)
 }
```

This drops the RIB-LIM widow's-limit floor and reduces the deceased's actual benefit directly, publishing $1,001.00 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/socialSecurity/survivorBenefit.evidence.test.ts
```

## Captured failing output

```
FAIL  src/socialSecurity/survivorBenefit.evidence.test.ts > survivor-benefit-rib-lim — Survivor benefit under RIB-LIM > floors the base at 82.5% of PIA and reduces it 28.5% at age 60
AssertionError: monthlyBenefit 1001.0000000000001 is not within {"abs":0.005} of the worksheet's 1179.75: expected false to be true // Object.is equality

FAIL  src/socialSecurity/survivorBenefit.evidence.test.ts > survivor-benefit-rib-lim — Survivor benefit under RIB-LIM > takes the widow limit over the deceased's smaller actual benefit
AssertionError: monthlyBenefit 1001.0000000000001 is not within {"abs":0.005} of the worksheet's 1179.75: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/socialSecurity/survivorBenefit.ts`, then `git diff --quiet -- packages/engine/src/socialSecurity/survivorBenefit.ts` exited 0, confirming no change to production code after the run.
