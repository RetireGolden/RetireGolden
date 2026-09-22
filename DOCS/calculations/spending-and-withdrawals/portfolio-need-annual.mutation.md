# Mutation receipt: portfolio-need-annual

Executed 2026-09-18 against RetireGolden base `39f8f460` (branch claude/b1-p4-cards-slice-nine) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualYearResultAssembly.ts`

```diff
@@ -307,7 +307,7 @@ export function annualYearResultAssembly(
     // no existing key moves position — key order is observable output here.
     netPortfolioNeed: Math.max(
       0,
-      ledger.expenses.total + tax.tax + tax.penalties - ledger.incomes.total,
+      ledger.expenses.total + tax.tax - ledger.incomes.total,
     ),
   }
 }
```

This omits penalties from the need, publishing $16,000 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualYearResultAssembly.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/projection/internal/annualYearResultAssembly.evidence.test.ts > portfolio-need-annual — Annual net portfolio need > publishes 17000 of uncovered outflow
AssertionError: netPortfolioNeed 16000 is not within {"abs":0.005} of the worksheet's 17000: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/internal/annualYearResultAssembly.ts`, then `git diff --quiet -- packages/engine/src/projection/internal/annualYearResultAssembly.ts` exited 0, confirming no change to production code after the run.
