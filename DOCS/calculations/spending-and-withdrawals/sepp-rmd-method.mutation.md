# Mutation receipt: sepp-rmd-method

Executed 2026-09-18 against RetireGolden base `989fc81b` (branch claude/b1-p4-cards-slice-eight) in `packages/engine`.

## Mutation applied to `packages/engine/src/strategies/sepp.ts`

```diff
@@ -79,7 +79,7 @@ export function seppAnnualAmount(
 ): number {
   if (balance <= 0) return 0
   const lifeExpectancy = singleLifeExpectancyYears(pack, age)
-  if (method === 'rmd') return balance / lifeExpectancy
+  if (method === 'rmd') return balance / (pack.rmd.uniformLifetimeTable[Math.floor(age)] as number)
   // Amortization: level payment amortizing `balance` over `lifeExpectancy` years
   // at `ratePct`. With r = 0 this degenerates to balance ÷ years.
   const r = ratePct / 100
```

This divides by the Uniform Lifetime Table entry instead of the Single Life divisor; the pack carries no age-55 Uniform entry, so the payment is NaN — the worksheet's first wrong reading, that an age-55 Uniform Lifetime lookup is unsupported.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/strategies/sepp.evidence.test.ts
```

## Captured failing output

```
FAIL  src/strategies/sepp.evidence.test.ts > sepp-rmd-method — SEPP RMD-method annual amount > divides the 316,000 start-of-year balance by the age-55 divisor 31.6
AssertionError: annualAmount NaN is not within "exact" of the worksheet's 10000: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/strategies/sepp.ts`, then `git diff --quiet -- packages/engine/src/strategies/sepp.ts` exited 0, confirming no change to production code after the run.
