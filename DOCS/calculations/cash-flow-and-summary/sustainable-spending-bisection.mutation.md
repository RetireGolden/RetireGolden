# Mutation receipt: sustainable-spending-bisection

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch `codex/b1-p4-cards-cashflow-optimizer-taxes`), and re-executed 2026-09-26 against RetireGolden base `6f58be5f` (branch `claude/solver-answers-unpriced-aca`; no pull request is open yet), and re-executed 2026-09-26 against RetireGolden base `5d3a72b1` (branch `claude/solver-answers-unpriced-aca`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `2c780ae5` (branch `claude/solver-answers-unpriced-aca`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `e1709b0e` (branch `claude/solver-answers-unpriced-aca`, pull request #748), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet) in `packages/engine`.

Re-executed 2026-09-18 after the worksheet extension.

## Mutation applied to `packages/engine/src/decisions/spendingSolver.ts`

```diff
diff --git a/packages/engine/src/decisions/spendingSolver.ts b/packages/engine/src/decisions/spendingSolver.ts
index d22c1686..3b472f8f 100644
--- a/packages/engine/src/decisions/spendingSolver.ts
+++ b/packages/engine/src/decisions/spendingSolver.ts
@@ -289,7 +289,7 @@ export function solveMaxSustainableSpending(
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

Re-executed for D-RECEIPT-DRIFT because its hunk header named a line its production code has since moved from; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (spendingSolver.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine9/packages/engine

 ❯ src/decisions/spendingSolver.evidence.test.ts (1 test | 1 failed) 57ms
   ❯ sustainable-spending-bisection — Sustainable spending bisection (1)
     × bisects the 60000/70000 bracket to the feasible lower bound 62500 56ms

 Test Files  1 failed (1)
      Tests  1 failed (1)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


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

The original bytes of `packages/engine/src/decisions/spendingSolver.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/decisions/spendingSolver.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
