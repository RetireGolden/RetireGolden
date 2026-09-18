# Mutation receipt: flexible-goal-scheduling

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch `codex/b1-p4-cards-cashflow-optimizer-taxes`) in `packages/engine`.

Re-executed 2026-09-18 after the worksheet extension.

## Mutation applied to `packages/engine/src/spending/flexibleGoals.ts`

```diff
diff --git a/packages/engine/src/spending/flexibleGoals.ts b/packages/engine/src/spending/flexibleGoals.ts
index 6a3cdf79..be4f26c7 100644
--- a/packages/engine/src/spending/flexibleGoals.ts
+++ b/packages/engine/src/spending/flexibleGoals.ts
@@ -118,7 +118,7 @@ function consume(budget: number | null, amount: number): number | null {
 }
 
 function partialAmount(goal: SchedulableGoal, budget: number | null, amount: number): number {
-  if (!goal.allowPartialFunding || budget === null || budget <= EPSILON) return 0
+  if (goal.allowPartialFunding || budget === null || budget <= EPSILON) return 0
   const minimum = amount * Math.max(0, Math.min(100, goal.minFundingPct)) / 100
   if (budget + EPSILON < minimum) return 0
   return Math.min(amount, budget)
```

Disable permitted partial funding, turning the worksheet partially funded goal into a deferral.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 npx.cmd vitest run src/spending/flexibleGoals.evidence.test.ts
```

## Captured failing output

The unmodified baseline passed (exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Mutation exit code: 1.

```
RUN  v5.0.0 C:/Users/Nathan/source/repos/RetireGolden/.worktrees/slice4-20260917/packages/engine

 ❯ src/spending/flexibleGoals.evidence.test.ts (2 tests | 1 failed) 6ms
   ❯ flexible-goal-scheduling — Flexible goal scheduling (2)
     × partially funds an inflated 1100 target with 700 and leaves 400 unfunded 5ms

 Test Files  1 failed (1)
      Tests  1 failed | 1 passed (2)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/spending/flexibleGoals.evidence.test.ts > flexible-goal-scheduling — Flexible goal scheduling > partially funds an inflated 1100 target with 700 and leaves 400 unfunded
AssertionError: expected 'deferred' to be 'partiallyFunded' // Object.is equality

Expected: "partiallyFunded"
Received: "deferred"

 ❯ src/spending/flexibleGoals.evidence.test.ts:25:28
     23|     const planned = scheduler.planYear(2026, { inflFactor: example.inp…
     24|     const actual = planned.results[0]!
     25|     expect(actual.outcome).toBe(example.expected.outcome)
       |                            ^
     26|     for (const key of ['amountNominal', 'fundedNominal', 'unfundedNomi…
     27|       expect(withinTolerance(actual[key], example.expected[key] as num…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

Ran `git checkout -- packages/engine/src/spending/flexibleGoals.ts`, then `git diff --quiet -- packages/engine/src/spending/flexibleGoals.ts` exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite passed (exit 0). The baseline and restored suite are green; no discrepancy remains.
