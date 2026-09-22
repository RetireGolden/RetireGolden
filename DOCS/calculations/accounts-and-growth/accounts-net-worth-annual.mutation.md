# Mutation receipt: accounts-net-worth-annual

Executed 2026-09-18 against RetireGolden base `39f8f460` (branch claude/b1-p4-cards-slice-nine) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualSnapshot.ts`

```diff
@@ -106,7 +106,7 @@ export function annualSnapshot(input: AnnualSnapshotInput): AnnualSnapshot {
   let hecmEffectiveDebt = 0
   for (const [id, line] of hecmStates) {
     hecmLoanTotal += line.loanBalance
-    hecmEffectiveDebt += Math.min(line.loanBalance, propertyValues.get(id) ?? 0)
+    hecmEffectiveDebt += line.loanBalance
   }
   let insuranceCashValueTotal = 0
   for (const [id, value] of insuranceCashValues) {
```

This drops the non-recourse cap, deducting the uncapped $470,000 of HECM balances and publishing $594,000 of net worth — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualYearResultAssembly.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/projection/internal/annualYearResultAssembly.evidence.test.ts > accounts-net-worth-annual — Annual net worth, with the non-recourse HECM cap > caps each HECM at its own home and composes 664000
AssertionError: hecmEffectiveDebt 470000 is not within {"abs":0.005} of the worksheet's 400000: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/internal/annualSnapshot.ts`, then `git diff --quiet -- packages/engine/src/projection/internal/annualSnapshot.ts` exited 0, confirming no change to production code after the run.
