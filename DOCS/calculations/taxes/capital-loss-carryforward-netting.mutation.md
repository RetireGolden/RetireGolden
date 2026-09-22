# Mutation receipt: capital-loss-carryforward-netting

Executed 2026-09-18 against RetireGolden base `989fc81b` (branch claude/b1-p4-cards-slice-eight) in `packages/engine`.

## Mutation applied to `packages/engine/src/tax/federalTax.ts`

```diff
@@ -483,7 +483,7 @@ export function applyCapitalLossCarryforward(
   )
   const remaining = availableLoss - usedAgainstOrdinary
   return {
-    ordinaryAfter: ordinary,
+    ordinaryAfter: ordinary - usedAgainstOrdinary,
     netCapitalGain:
       currentGain - usedAgainstGains - usedAgainstOrdinary,
     usedAgainstGains,
```

This subtracts the ordinary-offset slice from ordinary income instead of carrying it on the capital-gain line, so the year publishes ordinary income of $47,000 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/tax/federalTax.evidence.test.ts
```

## Captured failing output

```
FAIL  src/tax/federalTax.evidence.test.ts > capital-loss-carryforward-netting — Capital-loss carryforward netting > spends 5,000 of the pool against gains, reports a 3,000 loss on the capital line, and carries 12,000 forward
AssertionError: ordinaryAfter 47000 is not within "exact" of the worksheet's 50000: expected false to be true // Object.is equality

FAIL  src/tax/federalTax.evidence.test.ts > capital-loss-carryforward-netting — Capital-loss carryforward netting > leaves ordinary income untouched, so the offset is not an ordinary-income deduction
AssertionError: expected 47000 to be 50000 // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/tax/federalTax.ts`, then `git diff --quiet -- packages/engine/src/tax/federalTax.ts` exited 0, confirming no change to production code after the run.
