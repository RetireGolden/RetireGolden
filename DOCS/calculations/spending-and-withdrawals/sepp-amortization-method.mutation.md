# Mutation receipt: sepp-amortization-method

Executed 2026-09-18 against RetireGolden base `989fc81b` (branch claude/b1-p4-cards-slice-eight) in `packages/engine`.

## Mutation applied to `packages/engine/src/strategies/sepp.ts`

```diff
@@ -83,6 +83,6 @@ export function seppAnnualAmount(
   // Amortization: level payment amortizing `balance` over `lifeExpectancy` years
   // at `ratePct`. With r = 0 this degenerates to balance ÷ years.
   const r = ratePct / 100
-  if (r === 0) return balance / lifeExpectancy
+  if (r >= 0) return balance / lifeExpectancy
   return (balance * r) / (1 - Math.pow(1 + r, -lifeExpectancy))
 }
```

This takes the zero-rate degeneration at every rate, dividing the balance by the term for $10,000 despite a 5% rate — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/strategies/sepp.evidence.test.ts
```

## Captured failing output

```
FAIL  src/strategies/sepp.evidence.test.ts > sepp-amortization-method — SEPP amortization-method annual amount > amortizes 316,000 over the 31.6-year term at 5% into 20,101.84 a year
AssertionError: annualAmount 10000 is not within {"abs":0.005} of the worksheet's 20101.84: expected false to be true // Object.is equality

FAIL  src/strategies/sepp.evidence.test.ts > sepp-amortization-method — SEPP amortization-method annual amount > does not degenerate to simple division while the rate is nonzero
AssertionError: expected 10000 to be greater than 10000
```

## Revert

`git checkout -- packages/engine/src/strategies/sepp.ts`, then `git diff --quiet -- packages/engine/src/strategies/sepp.ts` exited 0, confirming no change to production code after the run.
