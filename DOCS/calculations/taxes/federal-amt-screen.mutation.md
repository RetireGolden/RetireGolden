# Mutation receipt: federal-amt-screen

Executed 2026-09-18 against RetireGolden base `989fc81b` (branch claude/b1-p4-cards-slice-eight) in `packages/engine`.

## Mutation applied to `packages/engine/src/tax/federalTax.ts`

```diff
@@ -411,7 +411,7 @@ function amtExemptionAmount(pack: ParameterPack, filingStatus: FilingStatus, amt
 function amtOrdinaryRateTax(pack: ParameterPack, taxableExcess: number): number {
   if (taxableExcess <= 0) return 0
   const rule = pack.federalTax.amt
-  const firstLayer = Math.min(taxableExcess, rule.rate28StartsAbove) * (rule.rate26Pct / 100)
+  const firstLayer = Math.min(taxableExcess, rule.rate28StartsAbove) * (rule.rate28Pct / 100)
   const secondLayer = Math.max(0, taxableExcess - rule.rate28StartsAbove) * (rule.rate28Pct / 100)
   return firstLayer + secondLayer
 }
```

This charges the 28% rate from the first dollar of AMT taxable excess, so tentative minimum tax becomes $30,772 and AMT $10,772 — the worksheet's second wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/tax/federalTax.evidence.test.ts
```

## Captured failing output

```
FAIL  src/tax/federalTax.evidence.test.ts > federal-amt-screen — Federal AMT screen > prices AMT at 8,574: 26% of the 109,900 excess over the 90,100 exemption, less 20,000 of regular tax
AssertionError: tentativeMinimumTax 30772.000000000004 is not within "exact" of the worksheet's 28574: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/tax/federalTax.ts`, then `git diff --quiet -- packages/engine/src/tax/federalTax.ts` exited 0, confirming no change to production code after the run.
