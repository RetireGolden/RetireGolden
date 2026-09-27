# Mutation receipt: flexible-goal-outcomes-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-nine` at base `39f8f460`, and re-executed 2026-09-22 against RetireGolden base `4fe87f00` (branch `claude/b1-p4-cards-nine-ten`, pull request #729), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet) in `packages/engine`.

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

This lets the fixed goal consume the flexible-goal budget in the pull-forward case, leaving $600 and turning the pulled-forward target goal from funded into deferred: counts 2/1/2/0 with $2,140 funded — the worksheet's first wrong reading. The cutting case is unchanged, because its budget is 0 either way.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualOneTimeGoalFundingPhase.evidence.test.ts
```

## Captured failing output

Re-executed for D-RECEIPT-DRIFT because the test counts it stated no longer matched the current test file; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (annualOneTimeGoalFundingPhase.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine9/packages/engine

 ❯ src/projection/internal/annualOneTimeGoalFundingPhase.evidence.test.ts (5 tests | 1 failed) 28ms
   ❯ flexible-goal-outcomes-annual — Annual flexible-goal outcomes: four counts and two amounts (3)
     × case A, a pull-forward year: 3 funded, 1 partial, 1 deferred, 0 skipped, 3240 funded and 500 unfunded 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 4 passed (5)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/annualOneTimeGoalFundingPhase.evidence.test.ts > flexible-goal-outcomes-annual — Annual flexible-goal outcomes: four counts and two amounts > case A, a pull-forward year: 3 funded, 1 partial, 1 deferred, 0 skipped, 3240 funded and 500 unfunded
AssertionError: pull-forward year funded: expected 2 to be 3 // Object.is equality

- Expected
+ Received

- 3
+ 2

 ❯ expectCounts src/projection/internal/annualOneTimeGoalFundingPhase.evidence.test.ts:90:48
     88|
     89|     function expectCounts(counts: ReturnType<typeof runYear>['goalOutc…
     90|       expect(counts.funded, `${label} funded`).toBe(want.funded)
       |                                                ^
     91|       expect(counts.partiallyFunded, `${label} partiallyFunded`).toBe(…
     92|       expect(counts.deferred, `${label} deferred`).toBe(want.deferred)
 ❯ src/projection/internal/annualOneTimeGoalFundingPhase.evidence.test.ts:106:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/spending/flexibleGoals.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/spending/flexibleGoals.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
