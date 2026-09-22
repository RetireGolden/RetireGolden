# Mutation receipt: social-security-cola-factor

Executed 2026-09-18 against RetireGolden base `989fc81b` (branch claude/b1-p4-cards-slice-eight) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/simulate.ts`

```diff
@@ -1653,7 +1653,7 @@ export function simulatePlan(plan: Plan, opts: SimulateOptions): ProjectionResul
     const ssColaFactor =
       plan.assumptions.ssCola.mode === 'matchInflation'
         ? inflFactorFrom(startYear, year)
-        : Math.pow(1 + plan.assumptions.ssCola.annualPct / 100, year - startYear)
+        : Math.pow(1 + plan.assumptions.ssCola.annualPct / 100, year - startYear + 1)
     const ssHaircutFactor =
       plan.assumptions.ssHaircut && year >= plan.assumptions.ssHaircut.fromYear
         ? 1 - plan.assumptions.ssHaircut.cutPct / 100
```

This applies the COLA once in the first projection year, so the start-year benefit is already escalated to $2,056 a month — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualSocialSecurity.evidence.test.ts
```

## Captured failing output

```
FAIL  src/projection/internal/annualSocialSecurity.evidence.test.ts > social-security-cola-factor — Social Security COLA factor > compounds 2.8% from the projection start, leaving the first year unescalated
AssertionError: monthly amount in 2026 2056 is not within {"abs":0.005} of the worksheet's 2000: expected false to be true // Object.is equality

FAIL  src/projection/internal/annualSocialSecurity.evidence.test.ts > social-security-cola-factor — Social Security COLA factor > does not escalate the first projection year
AssertionError: start-year benefit 24672 is not within {"abs":0.005} of the worksheet's 24000: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/simulate.ts`, then `git diff --quiet -- packages/engine/src/projection/simulate.ts` exited 0, confirming no change to production code after the run.
