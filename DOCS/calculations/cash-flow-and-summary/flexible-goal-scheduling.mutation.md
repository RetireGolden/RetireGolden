# Mutation receipt: flexible-goal-scheduling

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch `codex/b1-p4-cards-cashflow-optimizer-taxes`), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet) in `packages/engine`.

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

Re-executed for D-RECEIPT-DRIFT because the test lines it quoted no longer matched the current test file; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (flexibleGoals.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/spending/flexibleGoals.evidence.test.ts (2 tests | 1 failed) 6ms
   ❯ flexible-goal-scheduling — Flexible goal scheduling (2)
     × partially funds an inflated 1100 target with 700 and leaves 400 unfunded 5ms

 Test Files  1 failed (1)
      Tests  1 failed | 1 passed (2)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/spending/flexibleGoals.evidence.test.ts > flexible-goal-scheduling — Flexible goal scheduling > partially funds an inflated 1100 target with 700 and leaves 400 unfunded
AssertionError: expected 'skipped' to be 'partiallyFunded' // Object.is equality

Expected: "partiallyFunded"
Received: "skipped"

 ❯ src/spending/flexibleGoals.evidence.test.ts:26:28
     24|     const planned = scheduler.planYear(2027, { inflFactor: example.inp…
     25|     const actual = planned.results[0]!
     26|     expect(actual.outcome).toBe(example.expected.outcome)
       |                            ^
     27|     for (const key of ['amountNominal', 'fundedNominal', 'unfundedNomi…
     28|       expect(withinTolerance(actual[key], example.expected[key] as num…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/spending/flexibleGoals.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/spending/flexibleGoals.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
