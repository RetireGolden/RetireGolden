# Mutation receipt: sustainable-spending-bisection

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch `codex/b1-p4-cards-cashflow-optimizer-taxes`) in `packages/engine`.

Re-executed 2026-09-18 after the worksheet extension.

## Mutation applied to `packages/engine/src/decisions/spendingSolver.ts`

```diff
diff --git a/packages/engine/src/decisions/spendingSolver.ts b/packages/engine/src/decisions/spendingSolver.ts
index 1cd0d15e..e683d18a 100644
--- a/packages/engine/src/decisions/spendingSolver.ts
+++ b/packages/engine/src/decisions/spendingSolver.ts
@@ -175,7 +175,7 @@ export function solveMaxSustainableSpending(
       )
     }
     return {
-      maxBaseAnnual: bestFeasible?.amount ?? null,
+      maxBaseAnnual: upper,
       spendingSlackDollars: bestFeasible ? bestFeasible.amount - currentBaseAnnual : null,
       bestEvaluation: bestFeasible?.evaluation ?? null,
       converged,
```

Publish the infeasible upper bound instead of the last feasible lower bound.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 npx.cmd vitest run src/decisions/spendingSolver.evidence.test.ts
```

## Captured failing output

The unmodified baseline passed (exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Mutation exit code: 1.

```
RUN  v5.0.0 C:/Users/Nathan/source/repos/RetireGolden/.worktrees/slice4-20260917/packages/engine

 ❯ src/decisions/spendingSolver.evidence.test.ts (1 test | 1 failed) 58ms
   ❯ sustainable-spending-bisection — Sustainable spending bisection (1)
     × bisects the 60000/70000 bracket to the feasible lower bound 62500 57ms

 Test Files  1 failed (1)
      Tests  1 failed (1)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/decisions/spendingSolver.evidence.test.ts > sustainable-spending-bisection — Sustainable spending bisection > bisects the 60000/70000 bracket to the feasible lower bound 62500
AssertionError: maxBaseAnnual: actual 63125, worksheet 62500: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/decisions/spendingSolver.evidence.test.ts:40:209


⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

Ran `git checkout -- packages/engine/src/decisions/spendingSolver.ts`, then `git diff --quiet -- packages/engine/src/decisions/spendingSolver.ts` exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite passed (exit 0). The baseline and restored suite are green; no discrepancy remains.
