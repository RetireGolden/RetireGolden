# Mutation receipt: tax-realized-gains-annual

Executed 2026-09-18 against RetireGolden base `60e47fd8` (branch claude/b1-p4-cards-slice-eleven) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualYearResultAssembly.ts`

```diff
@@ -267,8 +267,7 @@
     withdrawals: funding.withdrawals,
     realizedGains:
       funding.realizedGains.withdrawal +
-      funding.realizedGains.rebalance +
-      funding.realizedGains.retirementAction,
+      funding.realizedGains.rebalance,
     taxableYield: ledger.incomes.taxableYield,
     taxExemptInterest: funding.taxExemptInterest,
     capitalLossUsedAgainstGains: funding.capitalLossUsedAgainstGains,
```

This drops the signed retirement-action loss, publishing $3,250 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualYearResultAssembly.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/projection/internal/annualYearResultAssembly.evidence.test.ts > tax-realized-gains-annual — Annual realized gains, signed and composed > folds 2500, 750 and -200 into a signed 3050
AssertionError: realizedGains 3250 is not within {"abs":0.005} of the worksheet's 3050: expected false to be true // Object.is equality
 FAIL  src/projection/internal/annualYearResultAssembly.evidence.test.ts > tax-realized-gains-annual — Annual realized gains, signed and composed > lets one source loss offset another source gain rather than flooring it
AssertionError: expected 2500 to be +0 // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/internal/annualYearResultAssembly.ts`, then `git diff --quiet -- packages/engine/src/projection/internal/annualYearResultAssembly.ts` exited 0, confirming no change to production code after the run.
