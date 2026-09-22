# Mutation receipt: federal-ltcg-stacking

Executed 2026-09-18 against RetireGolden base `989fc81b` (branch claude/b1-p4-cards-slice-eight) in `packages/engine`.

## Mutation applied to `packages/engine/src/tax/federalTax.ts`

```diff
@@ -396,7 +396,7 @@ function capitalGainsTaxStacked(
   const to = ordinaryTaxable + preferentialIncome
 
   // The layer below t15 is the 0% bracket and contributes no tax.
-  const at15 = Math.max(0, Math.min(to, t20) - Math.max(from, t15))
+  const at15 = Math.max(0, Math.min(to, t20) - from)
   const at20 = Math.max(0, to - Math.max(from, t20))
   return at15 * 0.15 + at20 * 0.2
 }
```

This starts the 15% band at ordinary taxable income instead of at the 15% threshold, taxing all $10,000 of preferential income at 15% for $1,500 — the worksheet's second wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/tax/federalTax.evidence.test.ts
```

## Captured failing output

```
FAIL  src/tax/federalTax.evidence.test.ts > federal-ltcg-stacking — Federal long-term capital gain stacking > taxes only the 5,550 of preferential income above the 49,450 zero-rate ceiling
AssertionError: capitalGainsTax 1500 is not within {"abs":0.005} of the worksheet's 832.5: expected false to be true // Object.is equality

FAIL  src/tax/federalTax.evidence.test.ts > federal-ltcg-stacking — Federal long-term capital gain stacking > charges nothing when every preferential dollar fits under the 15% threshold
AssertionError: expected 600 to be +0 // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/tax/federalTax.ts`, then `git diff --quiet -- packages/engine/src/tax/federalTax.ts` exited 0, confirming no change to production code after the run.
