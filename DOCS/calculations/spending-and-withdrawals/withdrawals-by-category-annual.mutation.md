# Mutation receipt: withdrawals-by-category-annual

Executed 2026-09-18 against RetireGolden base `39f8f460` (branch claude/b1-p4-cards-slice-nine) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualFundingApplicationAndClosePhase.ts`

```diff
@@ -1998,6 +1998,7 @@ export function annualFundingApplicationAndClosePhase(
       traditional:
         withdrawalPlan.byCategory.traditional +
         rmdTotal +
+        rmdTotal +
         seppTotal +
         inheritedOrdinaryIncome,
       roth: withdrawalPlan.byCategory.roth + inheritedRothForced,
```

This adds the owner RMD to the traditional category a second time, although the planned draw plus the RMD already is that category: the published traditional becomes $18,759.49 instead of $18,000 — the shape of the worksheet's first wrong reading, sized to this run's own RMD.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualFundingApplicationAndClosePhase.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/projection/internal/annualFundingApplicationAndClosePhase.evidence.test.ts > withdrawals-total-annual — Annual withdrawal total > sums the five categories to 42000
AssertionError: withdrawals.traditional 18759.493670886077 is not within {"abs":0.005} of the worksheet's 18000: expected false to be true // Object.is equality
 FAIL  src/projection/internal/annualFundingApplicationAndClosePhase.evidence.test.ts > withdrawals-by-category-annual — Annual withdrawals partitioned by source-account category > reports each account's draw in its own source category
AssertionError: withdrawals.traditional 18759.493670886077 is not within {"abs":0.005} of the worksheet's 18000: expected false to be true // Object.is equality
 FAIL  src/projection/internal/annualFundingApplicationAndClosePhase.evidence.test.ts > withdrawals-by-category-annual — Annual withdrawals partitioned by source-account category > keeps the RMD inside traditional rather than adding it again
AssertionError: withdrawals.traditional 18759.493670886077 is not within {"abs":0.005} of the worksheet's 18000: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/internal/annualFundingApplicationAndClosePhase.ts`, then `git diff --quiet -- packages/engine/src/projection/internal/annualFundingApplicationAndClosePhase.ts` exited 0, confirming no change to production code after the run.
