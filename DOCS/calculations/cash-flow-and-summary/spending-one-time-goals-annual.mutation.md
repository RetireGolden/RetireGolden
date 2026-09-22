# Mutation receipt: spending-one-time-goals-annual

Executed 2026-09-18 against RetireGolden base `60e47fd8` (branch claude/b1-p4-cards-slice-eleven) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualOneTimeGoalFundingPhase.ts`

```diff
@@ -130,7 +130,7 @@
     } else {
       for (const goal of input.oneTimeGoals) {
         if (goal.year !== year) continue
-        const amount = goal.amount * inflFactor
+        const amount = goal.amount
         oneTimeGoalsFunded += amount
         const classification = goal.classification ?? 'target'
         if (classification === 'required') requiredGoalsFunded += amount
```

This funds each goal at its today-dollar amount rather than the inflated one, publishing $15,000 — the worksheet's second wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualOneTimeGoalFundingPhase.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/projection/internal/annualOneTimeGoalFundingPhase.evidence.test.ts > spending-one-time-goals-annual — Annual funded one-time goals > funds both 2030 goals at the inflated amount and leaves the 2031 goal out
AssertionError: oneTimeGoalsFunded: actual 15000, worksheet 16500: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/internal/annualOneTimeGoalFundingPhase.ts`, then `git diff --quiet -- packages/engine/src/projection/internal/annualOneTimeGoalFundingPhase.ts` exited 0, confirming no change to production code after the run.
