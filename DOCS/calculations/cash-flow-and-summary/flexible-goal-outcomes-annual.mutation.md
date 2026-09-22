# Mutation receipt: flexible-goal-outcomes-annual

Executed 2026-09-18 against RetireGolden base `39f8f460` (branch claude/b1-p4-cards-slice-nine) in `packages/engine`.

## Mutation applied to `packages/engine/src/spending/flexibleGoals.ts`

```diff
@@ -159,6 +159,7 @@ export function createGoalScheduler(goals: SchedulableGoal[]): GoalScheduler {
         if (goal.flexibility === 'fixed') {
           if (year === goal.targetYear) {
             const funded = goal.amountTodayDollars * ctx.inflFactor
+            remainingBudget = consume(remainingBudget, funded)
             resolved.add(goal.id)
             results.push(result(goal, ctx, 'funded', funded))
           }
```

This lets the fixed goal consume the flexible-goal budget, leaving $600 and turning the target goal from funded into deferred: counts 1/1/2/1 with $1,700 funded — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualOneTimeGoalFundingPhase.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/projection/internal/annualOneTimeGoalFundingPhase.evidence.test.ts > flexible-goal-outcomes-annual — Annual flexible-goal outcomes: four counts and two amounts > publishes 2 funded, 1 partial, 1 deferred, 1 skipped, 2800 funded and 940 unfunded
AssertionError: expected 1 to be 2 // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/spending/flexibleGoals.ts`, then `git diff --quiet -- packages/engine/src/spending/flexibleGoals.ts` exited 0, confirming no change to production code after the run.
