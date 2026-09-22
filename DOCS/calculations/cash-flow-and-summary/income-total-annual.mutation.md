# Mutation receipt: income-total-annual

Executed 2026-09-18 against RetireGolden base `39f8f460` (branch claude/b1-p4-cards-slice-nine) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/simulate.ts`

```diff
@@ -1816,8 +1816,7 @@ export function simulatePlan(plan: Plan, opts: SimulateOptions): ProjectionResul
       incomes.tipsLadder +
       incomes.recurring +
       incomes.oneTime +
-      incomes.taxableYield +
-      incomes.taxExemptInterest
+      incomes.taxableYield
 
     // --- expenses ---------------------------------------------------------
     // The phase lives in `internal/annualExpenseAssemblyPhase.ts`: lifestyle
```

This drops tax-exempt interest from the nine-member sum, publishing $93,000 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/simulate.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/projection/simulate.evidence.test.ts > income-total-annual — Annual cash-income total > sums the nine members to 93500 and counts the character fields once
AssertionError: incomes.total 93000 is not within {"abs":0.005} of the worksheet's 93500: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/simulate.ts`, then `git diff --quiet -- packages/engine/src/projection/simulate.ts` exited 0, confirming no change to production code after the run.
